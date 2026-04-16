const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const prisma = new PrismaClient();

// GET /email/smtp-settings — get current user's SMTP config
const getSmtpSettings = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { smtpHost: true, smtpPort: true, smtpEmail: true, smtpPassword: true },
    });
    res.json({
      smtpHost: user.smtpHost || '',
      smtpPort: user.smtpPort || 587,
      smtpEmail: user.smtpEmail || '',
      hasPassword: !!user.smtpPassword,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /email/smtp-settings — save SMTP config
const saveSmtpSettings = async (req, res) => {
  try {
    const { smtpHost, smtpPort, smtpEmail, smtpPassword } = req.body;
    const data = {
      smtpHost: smtpHost || null,
      smtpPort: smtpPort ? parseInt(smtpPort) : 587,
      smtpEmail: smtpEmail || null,
    };
    // Only update password if provided
    if (smtpPassword) data.smtpPassword = smtpPassword;

    await prisma.user.update({ where: { id: req.user.id }, data });
    res.json({ message: 'SMTP settings saved' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /email/test — test SMTP connection
const testSmtp = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user.smtpHost || !user.smtpEmail || !user.smtpPassword) {
      return res.status(400).json({ message: 'SMTP settings not configured' });
    }

    const transporter = nodemailer.createTransport({
      host: user.smtpHost,
      port: user.smtpPort || 587,
      secure: (user.smtpPort || 587) === 465,
      auth: { user: user.smtpEmail, pass: user.smtpPassword },
      tls: { rejectUnauthorized: false },
    });

    await transporter.verify();
    res.json({ message: 'SMTP connection successful' });
  } catch (err) {
    res.status(400).json({ message: `SMTP test failed: ${err.message}` });
  }
};

// POST /email/send — send email
const sendEmail = async (req, res) => {
  try {
    const { to, cc, subject, body, clientId } = req.body;
    if (!to || !subject || !body) {
      return res.status(400).json({ message: 'to, subject, and body are required' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user.smtpHost || !user.smtpEmail || !user.smtpPassword) {
      return res.status(400).json({ message: 'يرجى إعداد بيانات SMTP أولاً من الإعدادات' });
    }

    const transporter = nodemailer.createTransport({
      host: user.smtpHost,
      port: user.smtpPort || 587,
      secure: (user.smtpPort || 587) === 465,
      auth: { user: user.smtpEmail, pass: user.smtpPassword },
      tls: { rejectUnauthorized: false },
    });

    const mailOptions = {
      from: `"${user.name}" <${user.smtpEmail}>`,
      to,
      subject,
      html: body,
    };
    if (cc) mailOptions.cc = cc;

    // Attach files if any
    if (req.files && req.files.length > 0) {
      mailOptions.attachments = req.files.map(f => ({
        filename: f.originalname,
        content: f.buffer,
        contentType: f.mimetype,
      }));
    }

    await transporter.sendMail(mailOptions);

    // Log the email
    await prisma.emailLog.create({
      data: {
        userId: req.user.id,
        clientId: clientId ? parseInt(clientId) : null,
        to, subject, body, status: 'sent',
      },
    });

    // Log activity if client
    if (clientId) {
      await prisma.activity.create({
        data: {
          clientId: parseInt(clientId),
          userId: req.user.id,
          type: 'email',
          description: `تم إرسال إيميل: ${subject}`,
        },
      });
    }

    res.json({ message: 'Email sent successfully' });
  } catch (err) {
    // Log failed attempt
    if (req.body.clientId) {
      await prisma.emailLog.create({
        data: {
          userId: req.user.id,
          clientId: parseInt(req.body.clientId),
          to: req.body.to, subject: req.body.subject,
          body: req.body.body, status: 'failed',
        },
      }).catch(() => {});
    }
    res.status(500).json({ message: `فشل إرسال الإيميل: ${err.message}` });
  }
};

// GET /email/logs — sent email history
const getEmailLogs = async (req, res) => {
  try {
    const { clientId } = req.query;
    const where = { userId: req.user.id };
    if (clientId) where.clientId = parseInt(clientId);

    const logs = await prisma.emailLog.findMany({
      where,
      include: {
        client: { select: { id: true, companyName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getSmtpSettings, saveSmtpSettings, testSmtp, sendEmail, getEmailLogs };
