const { PrismaClient } = require('@prisma/client');
const { getSubordinateIds } = require('../middleware/auth');
const prisma = new PrismaClient();

const ADMIN_ROLES = ['admin', 'general_manager', 'vice_gm'];

const buildPaymentFilter = async (user) => {
  if (ADMIN_ROLES.includes(user.role) || user.role === 'contract_officer'
      || user.role === 'credit_manager' || user.role === 'credit_officer') return {};
  if (user.role === 'assistant_sales' && user.managerId) {
    const teamIds = await getSubordinateIds(user.managerId);
    return { collectedBy: { in: [user.managerId, ...teamIds] } };
  }
  if (user.role === 'sales_director') {
    const subIds = await getSubordinateIds(user.id);
    return { collectedBy: { in: [user.id, ...subIds] } };
  }
  return { collectedBy: user.id };
};

const getPayments = async (req, res) => {
  try {
    const { contractId, clientId } = req.query;
    const accessFilter = await buildPaymentFilter(req.user);
    const where = {
      ...accessFilter,
      ...(contractId && { contractId: parseInt(contractId) }),
      ...(clientId && { clientId: parseInt(clientId) }),
    };

    const payments = await prisma.payment.findMany({
      where,
      include: {
        contract: { select: { id: true, contractRef: true, totalValue: true } },
        client: { select: { id: true, companyName: true } },
        collector: { select: { id: true, name: true } },
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
    const { contractId, clientId, amount, paymentDate, paymentType, reference, notes } = req.body;

    if (!contractId || !clientId || !amount || !paymentDate) {
      return res.status(400).json({ message: 'contractId, clientId, amount, and paymentDate are required' });
    }

    // Verify the contract exists and belongs to accessible scope
    const contract = await prisma.contract.findUnique({
      where: { id: parseInt(contractId) },
      select: { id: true, totalValue: true, collectedAmount: true, salesRepId: true }
    });
    if (!contract) return res.status(404).json({ message: 'Contract not found' });

    const receiptUrl = req.file ? req.file.filename : null;

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
      },
      include: {
        contract: { select: { id: true, contractRef: true, totalValue: true } },
        client: { select: { id: true, companyName: true } },
        collector: { select: { id: true, name: true } },
      }
    });

    // Update collectedAmount on the contract
    const newCollected = (contract.collectedAmount || 0) + parseFloat(amount);
    await prisma.contract.update({
      where: { id: parseInt(contractId) },
      data: { collectedAmount: newCollected }
    });

    // Log activity
    await prisma.activity.create({
      data: {
        clientId: parseInt(clientId),
        userId: req.user.id,
        type: 'note',
        description: `تم تسجيل دفعة بمبلغ ${parseFloat(amount).toLocaleString('ar-SA')} ر.س`
      }
    });

    res.status(201).json(payment);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getPaymentSummary = async (req, res) => {
  try {
    const { contractId, clientId } = req.query;

    if (contractId) {
      // Summary for a single contract
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
      const collected = contract.collectedAmount || 0;
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
        paymentCount: contract.payments.length,
        payments: contract.payments,
        collectionPct: totalValue > 0 ? Math.round((collected / totalValue) * 100) : 0,
      });
    }

    if (clientId) {
      // Summary for all contracts of a client
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

    // Subtract from contract collected amount
    await prisma.contract.update({
      where: { id: payment.contractId },
      data: { collectedAmount: { decrement: payment.amount } }
    });

    await prisma.payment.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Payment deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { getPayments, createPayment, getPaymentSummary, deletePayment };
