const { PrismaClient } = require('@prisma/client');
const { getSubordinateIds } = require('../middleware/auth');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const prisma = new PrismaClient();

// Send email from approver's SMTP to recipients
const sendApprovalEmail = async (sender, recipients, subject, htmlBody) => {
  if (!sender.smtpHost || !sender.smtpEmail || !sender.smtpPassword) {
    console.log(`[Email] Skipped - sender ${sender.name} has no SMTP configured`);
    return;
  }
  const recipientEmails = recipients.map(r => r.email).filter(e => e);
  if (recipientEmails.length === 0) return;

  try {
    const transporter = nodemailer.createTransport({
      host: sender.smtpHost,
      port: sender.smtpPort || 587,
      secure: (sender.smtpPort || 587) === 465,
      auth: { user: sender.smtpEmail, pass: sender.smtpPassword },
      tls: { rejectUnauthorized: false },
    });
    await transporter.sendMail({
      from: `"${sender.name}" <${sender.smtpEmail}>`,
      to: recipientEmails.join(', '),
      subject,
      html: htmlBody,
    });
    console.log(`[Email] Sent to ${recipientEmails.length} recipient(s)`);
  } catch (err) {
    console.error('[Email] Failed:', err.message);
  }
};

const buildEmailTemplate = (title, message, contractRef, clientName, hotelName, approverName) => `
<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f0f4f8;">
  <div style="background: #1a2f44; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
    <h2 style="margin: 0;">${title}</h2>
  </div>
  <div style="background: white; padding: 25px; border-radius: 0 0 8px 8px; border: 1px solid #d9e2ec;">
    <p style="font-size: 15px; color: #243b53; line-height: 1.6;">${message}</p>
    <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
      <tr><td style="padding: 8px 0; color: #486581;">رقم العقد:</td><td style="padding: 8px 0; font-weight: bold; color: #1a2f44; text-align: left;">${contractRef}</td></tr>
      <tr><td style="padding: 8px 0; color: #486581;">العميل:</td><td style="padding: 8px 0; font-weight: bold; color: #1a2f44; text-align: left;">${clientName}</td></tr>
      <tr><td style="padding: 8px 0; color: #486581;">الفندق:</td><td style="padding: 8px 0; font-weight: bold; color: #1a2f44; text-align: left;">${hotelName || '-'}</td></tr>
      <tr><td style="padding: 8px 0; color: #486581;">الموافق:</td><td style="padding: 8px 0; font-weight: bold; color: #1a2f44; text-align: left;">${approverName}</td></tr>
    </table>
    <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid #d9e2ec; text-align: center; color: #829ab1; font-size: 12px;">
      هذه رسالة تلقائية من نظام Ewaa Hotels CRM
    </div>
  </div>
</div>`;

const ADMIN_ROLES = ['general_manager', 'vice_gm'];

const buildContractFilter = async (user) => {
  if (ADMIN_ROLES.includes(user.role) || user.role === 'contract_officer' || user.role === 'reservations' || user.role === 'credit_manager' || user.role === 'credit_officer') return {};
  if (user.role === 'sales_director') {
    const subIds = await getSubordinateIds(user.id);
    return { salesRepId: { in: [user.id, ...subIds] } };
  }
  return { salesRepId: user.id };
};

const getContracts = async (req, res) => {
  try {
    const { status, hotelId, clientId, search } = req.query;
    const accessFilter = await buildContractFilter(req.user);
    const where = {
      ...accessFilter,
      ...(status && { status }),
      ...(hotelId && { hotelId: parseInt(hotelId) }),
      ...(clientId && { clientId: parseInt(clientId) }),
      ...(search && {
        client: {
          OR: [
            { companyName: { contains: search } },
            { contactPerson: { contains: search } }
          ]
        }
      })
    };

    const contracts = await prisma.contract.findMany({
      where,
      include: {
        client: { select: { id: true, companyName: true, contactPerson: true } },
        hotel: { select: { id: true, name: true } },
        salesRep: { select: { id: true, name: true, commissionRate: true } },
        approvals: {
          include: { approver: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(contracts);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getContract = async (req, res) => {
  try {
    const { id } = req.params;
    const contract = await prisma.contract.findUnique({
      where: { id: parseInt(id) },
      include: {
        client: { select: { id: true, companyName: true, contactPerson: true, phone: true } },
        hotel: { select: { id: true, name: true } },
        salesRep: { select: { id: true, name: true } },
        approvals: {
          include: { approver: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    if (!contract) return res.status(404).json({ message: 'Contract not found' });
    res.json(contract);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const uploadContract = async (req, res) => {
  try {
    const { clientId, hotelId, roomsCount, ratePerRoom, startDate, endDate, notes, contractRef } = req.body;

    if (!clientId || !hotelId) {
      return res.status(400).json({ message: 'Client and Hotel are required' });
    }

    const totalValue = roomsCount && ratePerRoom
      ? parseFloat(roomsCount) * parseFloat(ratePerRoom) * 365
      : null;

    const contractRef_ = contractRef || `CTR-${Date.now()}`;

    // Check for previous contracts with same client for comparison data
    const previousContracts = await prisma.contract.findMany({
      where: { clientId: parseInt(clientId), status: 'approved' },
      orderBy: { createdAt: 'desc' },
      take: 1
    });

    const contract = await prisma.contract.create({
      data: {
        clientId: parseInt(clientId),
        hotelId: parseInt(hotelId),
        salesRepId: req.user.id,
        fileUrl: req.file ? `/uploads/${req.file.filename}` : null,
        fileName: req.file ? req.file.originalname : null,
        roomsCount: roomsCount ? parseInt(roomsCount) : null,
        ratePerRoom: ratePerRoom ? parseFloat(ratePerRoom) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        totalValue,
        notes,
        contractRef: contractRef_
      },
      include: {
        client: { select: { companyName: true, contactPerson: true } },
        hotel: { select: { name: true } }
      }
    });

    // Log activity
    await prisma.activity.create({
      data: {
        clientId: parseInt(clientId),
        userId: req.user.id,
        type: 'contract_upload',
        description: `Contract uploaded: ${contractRef_} - Status: Pending Approval`
      }
    });

    // Recalculate pulse score
    await recalculatePulse(parseInt(clientId));

    const response = { ...contract, previousContract: previousContracts[0] || null };
    res.status(201).json(response);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const approveContract = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be approved or rejected' });
    }

    const current = await prisma.contract.findUnique({ where: { id: parseInt(id) } });
    if (!current) return res.status(404).json({ message: 'Contract not found' });

    // 3-step approval flow:
    // Step 1: sales_director approves pending → sales_approved
    // Step 2: contract_officer approves sales_approved → contract_approved
    // Step 3: credit_manager approves contract_approved → approved
    // GM/VGM can approve at any stage directly
    let newStatus = status;
    const role = req.user.role;

    if (status === 'approved') {
      if (role === 'general_manager' || role === 'vice_gm') {
        newStatus = 'approved';
      } else if (role === 'sales_director') {
        if (current.status !== 'pending') {
          return res.status(400).json({ message: 'العقد ليس في حالة "في الانتظار"' });
        }
        newStatus = 'sales_approved';
      } else if (role === 'contract_officer') {
        if (current.status !== 'sales_approved') {
          return res.status(400).json({ message: 'العقد لم يحصل على موافقة مدير المبيعات بعد' });
        }
        newStatus = 'contract_approved';
      } else if (role === 'credit_manager') {
        if (current.status !== 'contract_approved') {
          return res.status(400).json({ message: 'العقد لم يحصل على موافقة مسئول العقود بعد' });
        }
        newStatus = 'approved';
      }
    }

    const contract = await prisma.contract.update({
      where: { id: parseInt(id) },
      data: { status: newStatus },
      include: { client: { select: { id: true, companyName: true } } }
    });

    await prisma.contractApproval.create({
      data: {
        contractId: parseInt(id),
        approvedBy: req.user.id,
        status: newStatus,
        notes
      }
    });

    const statusLabels = {
      sales_approved: 'موافقة مدير المبيعات',
      contract_approved: 'موافقة مسئول العقود',
      approved: 'موافقة نهائية',
      rejected: 'مرفوض'
    };

    await prisma.activity.create({
      data: {
        clientId: contract.client.id,
        userId: req.user.id,
        type: 'contract_approval',
        description: `عقد ${contract.contractRef || id} — ${statusLabels[newStatus] || newStatus} بواسطة ${req.user.name}${notes ? ': ' + notes : ''}`
      }
    });

    // Only set client active on full approval
    if (newStatus === 'approved') {
      await prisma.client.update({
        where: { id: contract.client.id },
        data: { clientType: 'active' }
      });
    }

    // Notify next approver in the chain (in-app notification + email)
    const notifyNext = async (nextRole, msgTitle, msgBody, emailSubject) => {
      const users = await prisma.user.findMany({ where: { role: nextRole, isActive: true } });
      for (const u of users) {
        await prisma.notification.create({
          data: {
            userId: u.id,
            type: 'pending_approval',
            title: msgTitle,
            message: msgBody,
            link: '/contracts',
          },
        });
      }
      // Send email from approver's SMTP
      const sender = await prisma.user.findUnique({ where: { id: req.user.id } });
      const htmlBody = buildEmailTemplate(
        msgTitle, msgBody,
        contract.contractRef || `#${id}`,
        contract.client.companyName,
        contract.hotel?.name,
        req.user.name
      );
      await sendApprovalEmail(sender, users, emailSubject, htmlBody);
    };

    // Reload contract with hotel for email
    const contractWithHotel = await prisma.contract.findUnique({
      where: { id: parseInt(id) },
      include: { client: true, hotel: true }
    });
    contract.hotel = contractWithHotel.hotel;

    if (newStatus === 'sales_approved') {
      await notifyNext('contract_officer',
        'عقد ينتظر موافقتك',
        `عقد ${contract.contractRef || '#' + id} لشركة ${contract.client.companyName} حصل على موافقة مدير المبيعات وينتظر موافقتك`,
        `[CRM] عقد جديد ينتظر مراجعتك - ${contract.client.companyName}`
      );
    } else if (newStatus === 'contract_approved') {
      await notifyNext('credit_manager',
        'عقد ينتظر موافقتك',
        `عقد ${contract.contractRef || '#' + id} لشركة ${contract.client.companyName} حصل على موافقة مسئول العقود وينتظر موافقتك`,
        `[CRM] عقد جديد ينتظر موافقة الائتمان - ${contract.client.companyName}`
      );
    } else if (newStatus === 'approved') {
      await notifyNext('reservations',
        'عقد جديد معتمد نهائياً',
        `عقد ${contract.contractRef || '#' + id} لشركة ${contract.client.companyName} تمت الموافقة عليه نهائياً، نرجو الاطلاع عليه`,
        `[CRM] عقد جديد معتمد - ${contract.client.companyName}`
      );
    }

    await recalculatePulse(contract.client.id);
    res.json(contract);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getExpiringContracts = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const future = new Date();
    future.setDate(future.getDate() + days);
    const accessFilter = await buildContractFilter(req.user);

    const contracts = await prisma.contract.findMany({
      where: {
        ...accessFilter,
        status: 'approved',
        endDate: { lte: future, gte: new Date() }
      },
      include: {
        client: { select: { id: true, companyName: true, contactPerson: true, phone: true } },
        hotel: { select: { name: true } },
        salesRep: { select: { name: true } }
      },
      orderBy: { endDate: 'asc' }
    });

    res.json(contracts.map(c => ({
      ...c,
      daysUntilExpiry: Math.ceil((new Date(c.endDate) - new Date()) / (1000 * 60 * 60 * 24))
    })));
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const downloadContract = async (req, res) => {
  try {
    const { id } = req.params;
    const contract = await prisma.contract.findUnique({ where: { id: parseInt(id) } });
    if (!contract?.fileUrl) return res.status(404).json({ message: 'File not found' });
    const filePath = path.join(__dirname, '../../', contract.fileUrl);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File not found on server' });
    res.download(filePath, contract.fileName || 'contract');
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Recalculate Deal Pulse Score
const recalculatePulse = async (clientId) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);

    const [lastVisit, visitsLast30, activeContract, approvedContracts, client] = await Promise.all([
      prisma.visit.findFirst({ where: { clientId }, orderBy: { visitDate: 'desc' } }),
      prisma.visit.count({ where: { clientId, visitDate: { gte: thirtyDaysAgo } } }),
      prisma.contract.findFirst({ where: { clientId, status: 'approved', endDate: { gte: now } } }),
      prisma.contract.count({ where: { clientId, status: 'approved' } }),
      prisma.client.findUnique({ where: { id: clientId }, select: { salesRepId: true } })
    ]);

    const daysSince = lastVisit
      ? Math.floor((now - new Date(lastVisit.visitDate)) / (1000 * 60 * 60 * 24))
      : 999;

    const recencyScore = daysSince <= 7 ? 100 : daysSince <= 14 ? 80 : daysSince <= 30 ? 60 : daysSince <= 60 ? 40 : daysSince <= 90 ? 20 : 0;
    const visitScore = Math.min(visitsLast30 * 25, 100);
    const contractScore = activeContract ? 100 : approvedContracts > 0 ? 50 : 0;
    const engagementScore = Math.round((recencyScore * 0.4) + (visitScore * 0.3) + (contractScore * 0.3));

    const riskLevel = engagementScore >= 70 ? 'low' : engagementScore >= 40 ? 'medium' : 'high';
    const trend = visitsLast30 > 0 ? 'up' : daysSince > 60 ? 'down' : 'stable';

    let suggestedAction = null;
    if (daysSince > 30 && !activeContract) suggestedAction = 'Schedule urgent visit - no contact in 30+ days';
    else if (activeContract) {
      const daysToExpiry = Math.ceil((new Date(activeContract.endDate) - now) / (1000 * 60 * 60 * 24));
      if (daysToExpiry <= 30) suggestedAction = `Contract expires in ${daysToExpiry} days - start renewal discussions`;
      else if (daysToExpiry <= 60) suggestedAction = `Prepare renewal proposal - contract expires in ${daysToExpiry} days`;
    } else if (!activeContract && approvedContracts > 0) {
      suggestedAction = 'Client had contracts before - great opportunity for renewal';
    } else {
      suggestedAction = 'New lead - schedule introductory meeting';
    }

    await prisma.dealPulseScore.upsert({
      where: { clientId },
      create: {
        clientId, salesRepId: client.salesRepId,
        engagementScore, visitScore, contractScore, recencyScore,
        trend, riskLevel, daysSinceLastVisit: daysSince, suggestedAction
      },
      update: {
        engagementScore, visitScore, contractScore, recencyScore,
        trend, riskLevel, daysSinceLastVisit: daysSince,
        suggestedAction, lastCalculated: now
      }
    });
  } catch (err) {
    console.error('Pulse recalculation error:', err.message);
  }
};

// PUT /contracts/:id/confirm-booking — reservations confirms booking
const confirmBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { bookingNotes } = req.body;

    const contract = await prisma.contract.findUnique({
      where: { id: parseInt(id) },
      include: { client: true, hotel: true, salesRep: true }
    });
    if (!contract) return res.status(404).json({ message: 'Contract not found' });
    if (contract.status !== 'approved') {
      return res.status(400).json({ message: 'العقد لم يتم اعتماده نهائياً بعد' });
    }

    const data = {
      bookingConfirmed: true,
      bookingConfirmedAt: new Date(),
      bookingConfirmedBy: req.user.id,
      bookingNotes: bookingNotes || null,
    };
    if (req.file) {
      data.confirmationLetterUrl = `/uploads/${req.file.filename}`;
      data.confirmationLetterName = req.file.originalname;
    }

    const updated = await prisma.contract.update({
      where: { id: parseInt(id) },
      data
    });

    // Activity log
    await prisma.activity.create({
      data: {
        clientId: contract.client.id,
        userId: req.user.id,
        type: 'contract_approval',
        description: `تم تأكيد حجز الغرف لعقد ${contract.contractRef || '#' + id} بواسطة ${req.user.name}${bookingNotes ? ': ' + bookingNotes : ''}`
      }
    });

    // Notify sales rep + management
    const recipients = [contract.salesRepId];
    const managers = await prisma.user.findMany({
      where: { role: { in: ['general_manager', 'vice_gm', 'sales_director'] }, isActive: true }
    });
    managers.forEach(m => recipients.push(m.id));

    for (const userId of [...new Set(recipients)]) {
      await prisma.notification.create({
        data: {
          userId,
          type: 'general',
          title: 'تأكيد حجز الغرف',
          message: `تم تأكيد حجز الغرف لعقد ${contract.contractRef || '#' + id} - ${contract.client.companyName}`,
          link: '/contracts',
        }
      });
    }

    // Send email to client company confirming booking + readiness
    const sender = await prisma.user.findUnique({ where: { id: req.user.id } });
    const clientEmail = contract.client.email;
    if (clientEmail && sender.smtpHost && sender.smtpEmail && sender.smtpPassword) {
      try {
        const transporter = nodemailer.createTransport({
          host: sender.smtpHost,
          port: sender.smtpPort || 587,
          secure: (sender.smtpPort || 587) === 465,
          auth: { user: sender.smtpEmail, pass: sender.smtpPassword },
          tls: { rejectUnauthorized: false },
        });

        const dateRange = contract.startDate && contract.endDate
          ? `${new Date(contract.startDate).toLocaleDateString('ar-EG')} → ${new Date(contract.endDate).toLocaleDateString('ar-EG')}`
          : '-';

        const html = `
<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f0f4f8;">
  <div style="background: linear-gradient(135deg, #2d6a4f, #1a2f44); color: white; padding: 25px; border-radius: 8px 8px 0 0; text-align: center;">
    <h2 style="margin: 0; font-size: 22px;">✓ تأكيد الحجز</h2>
    <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">الفندق جاهز ومؤكد لاستقبال النزلاء</p>
  </div>
  <div style="background: white; padding: 25px; border-radius: 0 0 8px 8px; border: 1px solid #d9e2ec;">
    <p style="font-size: 15px; color: #243b53; line-height: 1.7;">
      السادة/ <strong>${contract.client.companyName}</strong>،<br><br>
      يسرنا إعلامكم بأنه تم <strong style="color: #2d6a4f;">تأكيد حجز الغرف</strong> الخاصة بعقدكم،
      وأن الفندق <strong>جاهز تماماً لاستقبال النزلاء</strong> وفقاً للتفاصيل المتفق عليها.
    </p>

    <div style="background: #f0f4f8; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <h3 style="margin: 0 0 12px; color: #1a2f44; font-size: 14px;">تفاصيل الحجز:</h3>
      <table style="width: 100%; font-size: 13px; color: #334e68;">
        <tr><td style="padding: 5px 0;">رقم العقد:</td><td style="font-weight: bold; text-align: left;">${contract.contractRef || '#' + id}</td></tr>
        <tr><td style="padding: 5px 0;">الفندق:</td><td style="font-weight: bold; text-align: left;">${contract.hotel?.name || '-'}</td></tr>
        <tr><td style="padding: 5px 0;">عدد الغرف:</td><td style="font-weight: bold; text-align: left;">${contract.roomsCount || '-'}</td></tr>
        <tr><td style="padding: 5px 0;">سعر الغرفة/ليلة:</td><td style="font-weight: bold; text-align: left;">${contract.ratePerRoom ? contract.ratePerRoom + ' ر.س' : '-'}</td></tr>
        <tr><td style="padding: 5px 0;">فترة الحجز:</td><td style="font-weight: bold; text-align: left;">${dateRange}</td></tr>
      </table>
    </div>

    ${bookingNotes ? `
    <div style="background: #fff8e6; border-right: 4px solid #f0b429; padding: 12px 15px; border-radius: 4px; margin: 15px 0;">
      <p style="margin: 0; font-size: 13px; color: #8d2b0b;"><strong>ملاحظات إضافية:</strong> ${bookingNotes}</p>
    </div>
    ` : ''}

    ${req.file ? `
    <div style="background: #e6f4ea; border-right: 4px solid #2d6a4f; padding: 12px 15px; border-radius: 4px; margin: 15px 0;">
      <p style="margin: 0; font-size: 13px; color: #1a4d2e;">
        📎 <strong>ملف تأكيد الحجز مرفق</strong> (Confirmation Letter من نظام Opera Cloud)
      </p>
    </div>
    ` : ''}

    <p style="font-size: 14px; color: #486581; line-height: 1.6;">
      نتشرف بخدمتكم ونؤكد لكم جاهزيتنا التامة لاستقبال نزلائكم في الموعد المحدد.
      لأي استفسار يرجى التواصل مع مندوبكم: <strong>${contract.salesRep?.name || ''}</strong>.
    </p>

    <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid #d9e2ec; text-align: center;">
      <p style="color: #1a2f44; font-weight: bold; margin: 0;">فنادق إيواء — Ewaa Hotels</p>
      <p style="color: #829ab1; font-size: 12px; margin: 5px 0 0;">رسالة تلقائية من نظام إدارة العقود والحجوزات</p>
    </div>
  </div>
</div>`;

        const mailOptions = {
          from: `"${sender.name} - فنادق إيواء" <${sender.smtpEmail}>`,
          to: clientEmail,
          subject: `تأكيد حجز الغرف - الفندق جاهز لاستقبال النزلاء - ${contract.contractRef || '#' + id}`,
          html,
        };

        // Attach confirmation letter if uploaded
        if (req.file) {
          mailOptions.attachments = [{
            filename: req.file.originalname,
            path: path.join(__dirname, '../../uploads', req.file.filename),
          }];
        }

        await transporter.sendMail(mailOptions);

        // Log email
        await prisma.emailLog.create({
          data: {
            userId: req.user.id,
            clientId: contract.client.id,
            to: clientEmail,
            subject: `تأكيد حجز الغرف - الفندق جاهز لاستقبال النزلاء`,
            body: html,
            status: 'sent',
          }
        });
      } catch (mailErr) {
        console.error('[Booking Email] Failed:', mailErr.message);
      }
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { getContracts, getContract, uploadContract, approveContract, confirmBooking, getExpiringContracts, downloadContract, recalculatePulse };
