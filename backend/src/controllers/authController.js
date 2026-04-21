const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendSystemEmail } = require('../utils/systemEmail');
const prisma = new PrismaClient();

const RESET_CODE_TTL_MIN = 10;
const RESET_CODE_MAX_ATTEMPTS = 5;
const RESET_RATE_LIMIT_PER_HOUR = 5;
const GENERIC_RESET_MSG = 'إذا كان البريد مسجلاً، تم إرسال كود التحقق إليه';

const resetEmailHtml = (name, code) => `
<div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #f0f4f8; padding: 24px;">
  <div style="background: #fff; border-radius: 12px; padding: 32px 28px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <h2 style="color: #1a2f44; margin: 0 0 12px;">إعادة تعيين كلمة المرور</h2>
    <p style="color: #486581; line-height: 1.7; margin: 0 0 20px;">
      مرحباً ${name || ''}،<br/>
      استلمنا طلب إعادة تعيين كلمة المرور لحسابك. استخدم الكود التالي لإكمال العملية:
    </p>
    <div style="background: #1a2f44; color: #fff; font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 18px; border-radius: 8px; margin: 20px 0; font-family: 'Courier New', monospace;">
      ${code}
    </div>
    <p style="color: #829ab1; font-size: 13px; line-height: 1.6; margin: 16px 0 0;">
      هذا الكود صالح لمدة ${RESET_CODE_TTL_MIN} دقائق فقط. إذا لم تطلب إعادة تعيين كلمة المرور، تجاهل هذه الرسالة.
    </p>
  </div>
  <p style="text-align: center; color: #829ab1; font-size: 12px; margin-top: 16px;">Ewaa Hotels CRM</p>
</div>`;

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required' });

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        manager: { select: { id: true, name: true, role: true } },
        hotels: { include: { hotel: { select: { id: true, name: true } } } }
      }
    });

    if (!user || !user.isActive)
      return res.status(401).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '8h' });

    const { password: _, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        manager: { select: { id: true, name: true, role: true } },
        hotels: { include: { hotel: { select: { id: true, name: true } } } }
      }
    });
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hashed } });
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'البريد الإلكتروني مطلوب' });

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await prisma.passwordResetCode.count({
      where: { email, createdAt: { gte: oneHourAgo } },
    });
    if (recent >= RESET_RATE_LIMIT_PER_HOUR) {
      return res.status(429).json({ message: 'تم تجاوز عدد محاولات إعادة التعيين. حاول بعد ساعة.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    // Always respond with the same message so we don't leak which emails exist.
    if (!user || !user.isActive) return res.json({ message: GENERIC_RESET_MSG });

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MIN * 60 * 1000);

    await prisma.passwordResetCode.updateMany({
      where: { email, used: false },
      data: { used: true },
    });
    await prisma.passwordResetCode.create({ data: { email, codeHash, expiresAt } });

    try {
      await sendSystemEmail({
        to: email,
        subject: 'كود إعادة تعيين كلمة المرور - Ewaa Hotels CRM',
        html: resetEmailHtml(user.name, code),
      });
    } catch (err) {
      console.error('Password reset email failed:', err.message);
      return res.status(500).json({ message: 'فشل إرسال البريد، تأكد من إعدادات SMTP.' });
    }

    res.json({ message: GENERIC_RESET_MSG });
  } catch (err) {
    console.error('forgotPassword error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: 'البريد والكود مطلوبان' });

    const record = await prisma.passwordResetCode.findFirst({
      where: { email, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) return res.status(400).json({ message: 'الكود غير صحيح أو منتهي الصلاحية' });

    if (record.attempts >= RESET_CODE_MAX_ATTEMPTS) {
      await prisma.passwordResetCode.update({ where: { id: record.id }, data: { used: true } });
      return res.status(400).json({ message: 'تجاوزت عدد المحاولات المسموح بها. اطلب كوداً جديداً.' });
    }

    const ok = await bcrypt.compare(String(code), record.codeHash);
    if (!ok) {
      await prisma.passwordResetCode.update({
        where: { id: record.id }, data: { attempts: record.attempts + 1 },
      });
      return res.status(400).json({ message: 'الكود غير صحيح' });
    }

    const resetToken = jwt.sign(
      { email, resetCodeId: record.id, purpose: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' },
    );
    res.json({ resetToken });
  } catch (err) {
    console.error('verifyResetCode error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword)
      return res.status(400).json({ message: 'الرمز وكلمة المرور الجديدة مطلوبان' });
    if (String(newPassword).length < 6)
      return res.status(400).json({ message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });

    let payload;
    try {
      payload = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ message: 'الرمز غير صحيح أو منتهي الصلاحية' });
    }
    if (payload.purpose !== 'password_reset')
      return res.status(400).json({ message: 'الرمز غير صحيح' });

    const record = await prisma.passwordResetCode.findUnique({ where: { id: payload.resetCodeId } });
    if (!record || record.used || record.expiresAt < new Date())
      return res.status(400).json({ message: 'انتهت صلاحية طلب إعادة التعيين. ابدأ من جديد.' });

    const user = await prisma.user.findUnique({ where: { email: payload.email } });
    if (!user || !user.isActive) return res.status(400).json({ message: 'الحساب غير موجود' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { password: hashed } }),
      prisma.passwordResetCode.update({ where: { id: record.id }, data: { used: true } }),
    ]);

    res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (err) {
    console.error('resetPassword error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { login, getMe, changePassword, forgotPassword, verifyResetCode, resetPassword };
