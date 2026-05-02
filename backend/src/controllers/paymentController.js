const { PrismaClient } = require('@prisma/client');
const { getSubordinateIds } = require('../middleware/auth');
const prisma = new PrismaClient();

const ADMIN_ROLES = ['admin', 'general_manager', 'vice_gm'];
const CREDIT_RECORD_ROLES = ['credit_officer'];           // can create payments (pending)
const CREDIT_APPROVE_ROLES = ['credit_manager'];          // can approve / reject

const buildPaymentFilter = async (user) => {
  if (ADMIN_ROLES.includes(user.role) || user.role === 'contract_officer'
      || user.role === 'credit_manager' || user.role === 'credit_officer') return {};
  if (user.role === 'assistant_sales' && user.managerId) {
    const teamIds = await getSubordinateIds(user.managerId);
    return {
      OR: [
        { collectedBy: { in: [user.managerId, ...teamIds] } },
        { contract: { salesRepId: { in: [user.managerId, ...teamIds] } } },
      ],
    };
  }
  if (user.role === 'sales_director') {
    const subIds = await getSubordinateIds(user.id);
    return {
      OR: [
        { collectedBy: { in: [user.id, ...subIds] } },
        { contract: { salesRepId: { in: [user.id, ...subIds] } } },
      ],
    };
  }
  return {
    OR: [
      { collectedBy: user.id },
      { contract: { salesRepId: user.id } },
    ],
  };
};

const getPayments = async (req, res) => {
  try {
    const { contractId, clientId, status } = req.query;
    const accessFilter = await buildPaymentFilter(req.user);
    const where = {
      ...accessFilter,
      ...(contractId && { contractId: parseInt(contractId) }),
      ...(clientId && { clientId: parseInt(clientId) }),
      ...(status && { status }),
    };

    const payments = await prisma.payment.findMany({
      where,
      include: {
        contract: { select: { id: true, contractRef: true, totalValue: true } },
        client: { select: { id: true, companyName: true } },
        collector: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
      },
      orderBy: { paymentDate: 'desc' }
    });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const createPayment = async (req, res) => {
  try {
    // Only credit officers (and admins) record payments. Sales reps/directors are blocked.
    if (!ADMIN_ROLES.includes(req.user.role) && !CREDIT_RECORD_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: 'تسجيل الدفعات يقتصر على موظف الائتمان' });
    }

    const { contractId, clientId, amount, paymentDate, paymentType, reference, notes } = req.body;

    if (!contractId || !clientId || !amount || !paymentDate) {
      return res.status(400).json({ message: 'contractId, clientId, amount, and paymentDate are required' });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: parseInt(contractId) },
      select: { id: true }
    });
    if (!contract) return res.status(404).json({ message: 'Contract not found' });

    const receiptUrl = req.file ? req.file.filename : null;

    // Created as pending — does NOT touch the contract's collectedAmount until approved.
    const payment = await prisma.payment.create({
      data: {
        contractId: parseInt(contractId),
        clientId: parseInt(clientId),
        amount: parseFloat(amount),
        paymentDate: new Date(paymentDate),
        paymentType,
        reference,
        notes,
        receiptUrl,
        collectedBy: req.user.id,
        status: 'pending',
      },
      include: {
        contract: { select: { id: true, contractRef: true, totalValue: true } },
        client: { select: { id: true, companyName: true } },
        collector: { select: { id: true, name: true } },
      }
    });

    await prisma.activity.create({
      data: {
        clientId: parseInt(clientId),
        userId: req.user.id,
        type: 'note',
        description: `تم تسجيل دفعة بمبلغ ${parseFloat(amount).toLocaleString('ar-SA')} ر.س — في انتظار موافقة مدير الائتمان`,
      }
    });

    res.status(201).json(payment);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const approvePayment = async (req, res) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role) && !CREDIT_APPROVE_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: 'الموافقة تقتصر على مدير الائتمان' });
    }
    const { id } = req.params;
    const payment = await prisma.payment.findUnique({
      where: { id: parseInt(id) },
      select: { id: true, contractId: true, clientId: true, amount: true, status: true }
    });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    if (payment.status !== 'pending') {
      return res.status(400).json({ message: `لا يمكن الموافقة — الحالة الحالية: ${payment.status}` });
    }

    // Approve and post to the contract's collected amount in a single transaction.
    const [updated] = await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'approved',
          approvedById: req.user.id,
          approvedAt: new Date(),
        },
        include: {
          contract: { select: { id: true, contractRef: true, totalValue: true } },
          client: { select: { id: true, companyName: true } },
          collector: { select: { id: true, name: true } },
          approver: { select: { id: true, name: true } },
        },
      }),
      prisma.contract.update({
        where: { id: payment.contractId },
        data: { collectedAmount: { increment: payment.amount } },
      }),
      prisma.activity.create({
        data: {
          clientId: payment.clientId,
          userId: req.user.id,
          type: 'note',
          description: `تمت الموافقة على دفعة بقيمة ${payment.amount.toLocaleString('ar-SA')} ر.س وإضافتها لحساب العميل`,
        }
      }),
    ]);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const rejectPayment = async (req, res) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role) && !CREDIT_APPROVE_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: 'الرفض يقتصر على مدير الائتمان' });
    }
    const { id } = req.params;
    const { approvalNotes } = req.body;
    const payment = await prisma.payment.findUnique({
      where: { id: parseInt(id) },
      select: { id: true, status: true, clientId: true, amount: true }
    });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    if (payment.status !== 'pending') {
      return res.status(400).json({ message: `لا يمكن الرفض — الحالة الحالية: ${payment.status}` });
    }

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'rejected',
        approvedById: req.user.id,
        approvedAt: new Date(),
        approvalNotes: approvalNotes || null,
      },
      include: {
        contract: { select: { id: true, contractRef: true, totalValue: true } },
        client: { select: { id: true, companyName: true } },
        collector: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
      },
    });

    await prisma.activity.create({
      data: {
        clientId: payment.clientId,
        userId: req.user.id,
        type: 'note',
        description: `تم رفض دفعة بقيمة ${payment.amount.toLocaleString('ar-SA')} ر.س${approvalNotes ? ` — السبب: ${approvalNotes}` : ''}`,
      }
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getPaymentSummary = async (req, res) => {
  try {
    const { contractId, clientId } = req.query;

    if (contractId) {
      const contract = await prisma.contract.findUnique({
        where: { id: parseInt(contractId) },
        select: {
          id: true, contractRef: true, totalValue: true, collectedAmount: true,
          salesRep: { select: { id: true, name: true, commissionRate: true } },
          client: { select: { id: true, companyName: true } },
          hotel: { select: { id: true, name: true } },
          payments: { orderBy: { paymentDate: 'desc' } }
        }
      });
      if (!contract) return res.status(404).json({ message: 'Contract not found' });

      const totalValue = contract.totalValue || 0;
      const collected = contract.collectedAmount || 0; // already only approved
      const remaining = Math.max(totalValue - collected, 0);
      const commissionAmount = contract.salesRep?.commissionRate
        ? (collected * contract.salesRep.commissionRate) / 100
        : 0;

      return res.json({
        contractId: contract.id,
        contractRef: contract.contractRef,
        client: contract.client,
        hotel: contract.hotel,
        salesRep: contract.salesRep,
        totalValue,
        collected,
        remaining,
        commissionRate: contract.salesRep?.commissionRate || 0,
        commissionAmount: Math.round(commissionAmount * 100) / 100,
        paymentCount: contract.payments.filter(p => p.status === 'approved').length,
        pendingCount: contract.payments.filter(p => p.status === 'pending').length,
        payments: contract.payments,
        collectionPct: totalValue > 0 ? Math.round((collected / totalValue) * 100) : 0,
      });
    }

    if (clientId) {
      const contracts = await prisma.contract.findMany({
        where: { clientId: parseInt(clientId) },
        select: {
          id: true, contractRef: true, totalValue: true, collectedAmount: true, status: true,
          hotel: { select: { id: true, name: true } },
          salesRep: { select: { id: true, name: true, commissionRate: true } },
          startDate: true, endDate: true,
          _count: { select: { payments: true } }
        }
      });

      const totalValue = contracts.reduce((s, c) => s + (c.totalValue || 0), 0);
      const totalCollected = contracts.reduce((s, c) => s + (c.collectedAmount || 0), 0);
      const totalRemaining = Math.max(totalValue - totalCollected, 0);

      return res.json({
        clientId: parseInt(clientId),
        totalValue,
        totalCollected,
        totalRemaining,
        collectionPct: totalValue > 0 ? Math.round((totalCollected / totalValue) * 100) : 0,
        contracts: contracts.map(c => ({
          ...c,
          remaining: Math.max((c.totalValue || 0) - (c.collectedAmount || 0), 0),
          collectionPct: (c.totalValue || 0) > 0
            ? Math.round(((c.collectedAmount || 0) / c.totalValue) * 100)
            : 0,
        }))
      });
    }

    return res.status(400).json({ message: 'Provide contractId or clientId' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const deletePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await prisma.payment.findUnique({ where: { id: parseInt(id) } });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    // Only approved payments contributed to collectedAmount, so we only decrement when deleting an approved one.
    if (payment.status === 'approved') {
      await prisma.contract.update({
        where: { id: payment.contractId },
        data: { collectedAmount: { decrement: payment.amount } }
      });
    }

    await prisma.payment.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Payment deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { getPayments, createPayment, approvePayment, rejectPayment, getPaymentSummary, deletePayment };
