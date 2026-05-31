const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { prisma } = require('../lib/db');
const { ingestEmail } = require('../services/ingest');

const BATCH_SIZE = 200;

function friendlyError(err) {
  if (err.authenticationFailed) return 'فشل تسجيل الدخول';
  if (err.code === 'ENOTFOUND') return `الـ Host مش موجود: ${err.hostname || ''}`;
  if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') return 'انتهت مهلة الاتصال';
  if (err.code === 'ECONNREFUSED') return 'الاتصال مرفوض';
  if (err.responseText) return err.responseText;
  return err.message || 'خطأ غير معروف';
}

async function processMessage(client, msg, account, verbose) {
  const parsed = await simpleParser(msg.source);
  const messageId = parsed.messageId || `${account.id}-uid-${msg.uid}`;

  const existing = await prisma.bookingEmail.findUnique({ where: { messageId } });
  if (existing) return { status: 'duplicate', uid: msg.uid };

  const emailRow = await prisma.bookingEmail.create({
    data: {
      messageId,
      uid: msg.uid,
      mailbox: account.mailbox,
      fromAddr: parsed.from?.value?.[0]?.address || parsed.from?.text || 'unknown',
      toAddr: parsed.to?.text || account.user,
      subject: parsed.subject || '(no subject)',
      receivedAt: parsed.date || new Date(),
      rawText: parsed.text || '',
      rawHtml: parsed.html || null,
      parseStatus: 'pending',
    },
  });

  const ingestResult = await ingestEmail(emailRow);
  if (verbose) console.log(`[poller] uid=${msg.uid} ${ingestResult.status} - ${emailRow.subject.slice(0, 60)}`);
  return { status: ingestResult.status, uid: msg.uid, subject: emailRow.subject };
}

async function fetchRange(client, range, opts, account, verbose) {
  let processed = 0;
  let errors = 0;
  const uids = [];
  const results = [];

  try {
    for await (const msg of client.fetch(range, {
      envelope: true,
      source: true,
      uid: true,
    }, opts)) {
      uids.push(msg.uid);
      try {
        const r = await processMessage(client, msg, account, verbose);
        if (r.status !== 'duplicate') processed++;
        results.push(r);
      } catch (e) {
        errors++;
        console.error(`[poller] uid=${msg.uid} error: ${e.message}`);
      }
    }
  } catch (fetchErr) {
    console.error(`[poller] fetch range error (${range}): ${fetchErr.message}`);
  }

  return { processed, errors, uids, results };
}

async function pollOnce({ verbose = false } = {}) {
  const account = await prisma.otaImapAccount.findFirst({
    where: { enabled: true },
    orderBy: { id: 'asc' },
  });

  if (!account) {
    if (verbose) console.log('[poller] no enabled account');
    return { ok: false, reason: 'no_account' };
  }

  const client = new ImapFlow({
    host: account.host,
    port: account.port,
    secure: account.secure,
    auth: { user: account.user, pass: account.password },
    logger: false,
    socketTimeout: 60000,
  });

  let clientErrored = null;
  client.on('error', (e) => {
    if (!clientErrored) clientErrored = e;
    console.error('[poller] client error event:', e.message);
  });
  client.on('close', () => {
    if (verbose) console.log('[poller] client closed');
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock(account.mailbox || 'INBOX');

    try {
      const status = await client.status(account.mailbox || 'INBOX', {
        messages: true,
        uidNext: true,
      });
      const totalMessages = status.messages || 0;
      const uidNext = status.uidNext || 1;

      await prisma.otaImapAccount.update({
        where: { id: account.id },
        data: { serverMessageCount: totalMessages },
      });

      let newerResult = { processed: 0, errors: 0, uids: [] };
      let olderResult = { processed: 0, errors: 0, uids: [] };

      if (account.lastSeenUid == null && account.oldestSeenUid == null) {
        if (totalMessages === 0) {
          lock.release();
          await client.logout();
          await prisma.otaImapAccount.update({
            where: { id: account.id },
            data: { lastPollAt: new Date(), lastError: null },
          });
          return { ok: true, processed: 0, errors: 0, phase: 'empty_mailbox' };
        }
        const startSeq = Math.max(1, totalMessages - BATCH_SIZE + 1);
        const range = `${startSeq}:${totalMessages}`;
        if (verbose) console.log(`[poller] first run, seq range ${range}`);
        newerResult = await fetchRange(client, range, {}, account, verbose);
      } else {
        if (account.lastSeenUid != null && account.lastSeenUid + 1 < uidNext) {
          const range = `${account.lastSeenUid + 1}:*`;
          if (verbose) console.log(`[poller] incremental UID range ${range}`);
          newerResult = await fetchRange(client, range, { uid: true }, account, verbose);
        }

        if (account.oldestSeenUid != null && account.oldestSeenUid > 1) {
          const olderEnd = account.oldestSeenUid - 1;
          const olderStart = Math.max(1, olderEnd - BATCH_SIZE + 1);
          const range = `${olderStart}:${olderEnd}`;
          if (verbose) console.log(`[poller] backfill UID range ${range}`);
          olderResult = await fetchRange(client, range, { uid: true }, account, verbose);
        }
      }

      const allUids = [...newerResult.uids, ...olderResult.uids];
      let newLastSeen = account.lastSeenUid;
      let newOldestSeen = account.oldestSeenUid;

      if (allUids.length > 0) {
        const maxUid = Math.max(...allUids);
        const minUid = Math.min(...allUids);
        if (newLastSeen == null || maxUid > newLastSeen) newLastSeen = maxUid;
        if (newOldestSeen == null || minUid < newOldestSeen) newOldestSeen = minUid;
      }

      const totalProcessed = newerResult.processed + olderResult.processed;
      const totalErrors = newerResult.errors + olderResult.errors;

      await prisma.otaImapAccount.update({
        where: { id: account.id },
        data: {
          lastPollAt: new Date(),
          lastSeenUid: newLastSeen,
          oldestSeenUid: newOldestSeen,
          totalFetched: account.totalFetched + totalProcessed,
          lastError: null,
        },
      });

      try { lock.release(); } catch {}
      try { await client.logout(); } catch {}

      const backfillDone = newOldestSeen != null && newOldestSeen <= 1;

      return {
        ok: true,
        processed: totalProcessed,
        errors: totalErrors,
        newer: newerResult.processed,
        older: olderResult.processed,
        backfillDone,
        oldestSeenUid: newOldestSeen,
        lastSeenUid: newLastSeen,
        serverMessageCount: totalMessages,
        results: [...newerResult.results, ...olderResult.results].slice(0, 20),
      };
    } catch (innerErr) {
      try { lock.release(); } catch {}
      throw innerErr;
    }
  } catch (err) {
    try { await client.logout(); } catch {}
    try { client.close(); } catch {}
    const friendly = friendlyError(err);
    console.error('[poller] error:', err.message);

    try {
      await prisma.otaImapAccount.update({
        where: { id: account.id },
        data: { lastPollAt: new Date(), lastError: friendly.slice(0, 500) },
      });
    } catch {}

    return { ok: false, error: friendly, technical: err.message, code: err.code };
  }
}

module.exports = { pollOnce };
