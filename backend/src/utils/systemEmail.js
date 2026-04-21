const nodemailer = require('nodemailer');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// System emails (e.g. password reset) are sent while the user is unauthenticated,
// so they can't use the per-user SMTP flow. We try env SMTP first, then fall
// back to the admin account's stored SMTP credentials.
const buildTransporter = async () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const port = parseInt(process.env.SMTP_PORT) || 587;
    return {
      transporter: nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        tls: { rejectUnauthorized: false },
      }),
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      fromName: process.env.SMTP_FROM_NAME || 'Ewaa Hotels CRM',
    };
  }

  const admin = await prisma.user.findFirst({
    where: { role: { in: ['admin', 'general_manager'] }, smtpHost: { not: null }, smtpPassword: { not: null } },
    orderBy: { role: 'asc' },
  });
  if (!admin) return null;

  return {
    transporter: nodemailer.createTransport({
      host: admin.smtpHost,
      port: admin.smtpPort || 587,
      secure: (admin.smtpPort || 587) === 465,
      auth: { user: admin.smtpEmail, pass: admin.smtpPassword },
      tls: { rejectUnauthorized: false },
    }),
    from: admin.smtpEmail,
    fromName: admin.name,
  };
};

const sendSystemEmail = async ({ to, subject, html }) => {
  const cfg = await buildTransporter();
  if (!cfg) throw new Error('SMTP غير معد. يرجى ضبط إعدادات البريد في ملف .env أو حساب المسؤول.');
  await cfg.transporter.sendMail({
    from: `"${cfg.fromName}" <${cfg.from}>`,
    to,
    subject,
    html,
  });
};

module.exports = { sendSystemEmail };
