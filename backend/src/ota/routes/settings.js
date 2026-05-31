const express = require('express');
const { ImapFlow } = require('imapflow');
const { prisma } = require('../lib/db');
const scheduler = require('../worker/scheduler');
const { pollOnce } = require('../worker/poller');

const router = express.Router();

const PASSWORD_MASK = '••••••••';

function maskAccount(acc) {
  if (!acc) return null;
  return { ...acc, password: acc.password ? PASSWORD_MASK : '' };
}

router.get('/imap', async (_req, res) => {
  try {
    const account = await prisma.otaImapAccount.findFirst({ orderBy: { id: 'asc' } });
    res.json({ account: maskAccount(account) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/imap', async (req, res) => {
  try {
    const { id, name, host, port, secure, user, password, mailbox, pollIntervalSec, enabled } = req.body;

    if (!host || !user) return res.status(400).json({ error: 'host و user مطلوبين' });
    if (!id && !password) return res.status(400).json({ error: 'password مطلوب لأول مرة' });

    const data = {
      name: name || 'Default',
      host,
      port: parseInt(port, 10) || 993,
      secure: secure !== false,
      user,
      mailbox: mailbox || 'INBOX',
      pollIntervalSec: parseInt(pollIntervalSec, 10) || 120,
      enabled: enabled !== false,
    };
    if (password && password !== PASSWORD_MASK) data.password = password;

    let account;
    if (id) {
      account = await prisma.otaImapAccount.update({ where: { id: parseInt(id, 10) }, data });
    } else {
      account = await prisma.otaImapAccount.create({ data: { ...data, password } });
    }

    await scheduler.reschedule().catch(() => {});

    res.json({ account: maskAccount(account) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/imap/test', async (req, res) => {
  const { id, host, port, secure, user, password, mailbox } = req.body;

  let effectivePassword = password;
  if (id && (!password || password === PASSWORD_MASK)) {
    const saved = await prisma.otaImapAccount.findUnique({ where: { id: parseInt(id, 10) } });
    effectivePassword = saved ? saved.password : null;
  }

  if (!host || !user || !effectivePassword) {
    return res.status(400).json({ ok: false, error: 'host / user / password مطلوبين للاختبار' });
  }

  const client = new ImapFlow({
    host,
    port: parseInt(port, 10) || 993,
    secure: secure !== false,
    auth: { user, pass: effectivePassword },
    logger: false,
    socketTimeout: 15000,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock(mailbox || 'INBOX');
    const status = await client.status(mailbox || 'INBOX', { messages: true, unseen: true });
    lock.release();
    await client.logout();

    if (id) {
      await prisma.otaImapAccount.update({
        where: { id: parseInt(id, 10) },
        data: { lastTestedAt: new Date(), lastTestOk: true, lastError: null },
      });
    }

    res.json({
      ok: true,
      mailbox: mailbox || 'INBOX',
      messages: status.messages || 0,
      unseen: status.unseen || 0,
    });
  } catch (err) {
    try { await client.logout(); } catch {}

    let friendly = err.message;
    if (err.authenticationFailed) {
      friendly = 'فشل تسجيل الدخول — تأكد من اليوزر وكلمة المرور (لو Gmail استخدم App Password)';
    } else if (err.code === 'ENOTFOUND') {
      friendly = `الـ Host مش موجود: ${err.hostname || host} — تأكد من العنوان`;
    } else if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
      friendly = 'انتهت مهلة الاتصال — تحقق من الـ host والـ port والـ firewall';
    } else if (err.code === 'ECONNREFUSED') {
      friendly = 'الاتصال مرفوض — تأكد من البورت';
    } else if (err.responseText) {
      friendly = err.responseText;
    }

    if (id) {
      await prisma.otaImapAccount.update({
        where: { id: parseInt(id, 10) },
        data: { lastTestedAt: new Date(), lastTestOk: false, lastError: friendly.slice(0, 500) },
      }).catch(() => {});
    }

    res.status(400).json({ ok: false, error: friendly, technical: err.message });
  }
});

router.post('/imap/run-now', async (_req, res) => {
  try {
    const result = await pollOnce({ verbose: true });
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/imap/reset', async (_req, res) => {
  try {
    const evt = await prisma.bookingEvent.deleteMany();
    const r = await prisma.reservation.deleteMany();
    const em = await prisma.bookingEmail.deleteMany();
    const orphanHotels = await prisma.hotel.deleteMany({
      where: {
        AND: [
          { bookingComId: null },
          { agodaId: null },
          { expediaId: null },
          { almosaferId: null },
        ],
      },
    });
    await prisma.otaImapAccount.updateMany({
      data: { lastSeenUid: null, oldestSeenUid: null, totalFetched: 0, lastError: null },
    });
    const remainingHotels = await prisma.hotel.count();
    res.json({
      ok: true,
      deleted: { events: evt.count, reservations: r.count, emails: em.count, orphanHotels: orphanHotels.count },
      kept: { hotels: remainingHotels },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/imap/progress', async (_req, res) => {
  try {
    const account = await prisma.otaImapAccount.findFirst();
    if (!account) return res.json({ ok: false, hasAccount: false });
    const emailCount = await prisma.bookingEmail.count();
    const skipped = await prisma.bookingEmail.count({ where: { parseStatus: 'skipped' } });
    const parsed = await prisma.bookingEmail.count({ where: { parseStatus: 'parsed' } });
    const failed = await prisma.bookingEmail.count({ where: { parseStatus: 'failed' } });
    const manualReview = await prisma.bookingEmail.count({ where: { parseStatus: 'manual_review' } });
    const reservations = await prisma.reservation.count();

    const backfillDone = account.oldestSeenUid != null && account.oldestSeenUid <= 1;
    const serverTotal = account.serverMessageCount || 0;

    res.json({
      ok: true,
      hasAccount: true,
      lastSeenUid: account.lastSeenUid,
      oldestSeenUid: account.oldestSeenUid,
      serverMessageCount: serverTotal,
      lastPollAt: account.lastPollAt,
      backfillDone,
      totalFetched: account.totalFetched,
      emailCount,
      stats: { parsed, skipped, failed, manualReview },
      reservations,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.delete('/imap/:id', async (req, res) => {
  try {
    await prisma.otaImapAccount.delete({ where: { id: parseInt(req.params.id, 10) } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
