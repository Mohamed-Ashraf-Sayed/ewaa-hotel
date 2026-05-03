// Background job that polls every active ImapAccount in the DB and stores
// matching emails as InboxEmail rows. Falls back to env-var config (single
// account) when there are no DB-defined accounts.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SCHEDULER_TICK_MS = 60_000; // master tick every minute; each account decides whether to run based on its own interval

let schedulerTimer = null;
const polling = new Set(); // ids currently polling, prevent overlap per-account

const safeText = (s) => (s == null ? null : String(s).slice(0, 500_000));

const pollAccount = async (account) => {
  if (!account || polling.has(account.id)) return;
  polling.add(account.id);
  let client;
  try {
    const { ImapFlow } = require('imapflow');
    const { simpleParser } = require('mailparser');

    client = new ImapFlow({
      host: account.host,
      port: account.port,
      secure: account.secure,
      auth: { user: account.username, pass: account.password },
      logger: false,
    });
    await client.connect();

    const lock = await client.getMailboxLock(account.mailbox || 'INBOX');
    try {
      const status = await client.status(account.mailbox || 'INBOX', { messages: true });
      const total = status.messages || 0;
      if (total === 0) {
        await prisma.imapAccount.update({ where: { id: account.id }, data: { lastPolledAt: new Date(), lastError: null } });
        return;
      }
      const start = Math.max(1, total - 200);
      const range = `${start}:${total}`;

      // Cache the client lookup map only when needed
      let clientByEmail = null;
      const ensureClientMap = async () => {
        if (clientByEmail) return clientByEmail;
        const list = await prisma.client.findMany({
          where: { isActive: true, email: { not: null } },
          select: { id: true, email: true },
        });
        clientByEmail = new Map();
        for (const c of list) {
          if (c.email) clientByEmail.set(c.email.trim().toLowerCase(), c);
        }
        return clientByEmail;
      };

      let stored = 0;
      for await (const msg of client.fetch(range, { source: true, envelope: true, internalDate: true })) {
        try {
          const messageId = msg.envelope?.messageId || `<${msg.uid}@${account.id}>`;
          const exists = await prisma.inboxEmail.findUnique({ where: { messageId } });
          if (exists) continue;

          const fromAddr = (msg.envelope?.from && msg.envelope.from[0]) || null;
          const fromEmail = (fromAddr?.address || '').trim().toLowerCase();
          if (!fromEmail) continue;

          // Filter: only client emails unless captureAll
          let matchedClient = null;
          if (!account.captureAll) {
            const map = await ensureClientMap();
            matchedClient = map.get(fromEmail);
            if (!matchedClient) continue;
          } else {
            const map = await ensureClientMap();
            matchedClient = map.get(fromEmail) || null;
          }

          const parsed = await simpleParser(msg.source);
          const attachments = (parsed.attachments || []).map(a => ({
            filename: a.filename || 'attachment',
            size: a.size || 0,
            contentType: a.contentType || 'application/octet-stream',
          }));

          await prisma.inboxEmail.create({
            data: {
              messageId,
              fromEmail,
              fromName: fromAddr?.name || null,
              toEmail: (msg.envelope?.to && msg.envelope.to[0]?.address) || account.username,
              subject: parsed.subject || msg.envelope?.subject || '(no subject)',
              bodyText: safeText(parsed.text),
              bodyHtml: safeText(parsed.html || null),
              receivedAt: msg.internalDate || new Date(),
              category: 'client',
              hasAttachments: attachments.length > 0,
              attachmentsJson: attachments.length > 0 ? JSON.stringify(attachments) : null,
              clientId: matchedClient?.id || null,
              imapAccountId: account.id,
            },
          });
          stored += 1;
        } catch (perMsgErr) {
          // skip this message but continue
          console.warn(`[InboxPoll:${account.label}] skip message:`, perMsgErr.message);
        }
      }
      await prisma.imapAccount.update({ where: { id: account.id }, data: { lastPolledAt: new Date(), lastError: null } });
      if (stored > 0) console.log(`[InboxPoll:${account.label}] stored ${stored} new email(s)`);
    } finally {
      lock.release();
    }
  } catch (err) {
    console.warn(`[InboxPoll:${account.label}] failed:`, err.message);
    try { await prisma.imapAccount.update({ where: { id: account.id }, data: { lastError: err.message } }); } catch (_) {}
  } finally {
    if (client) { try { await client.logout(); } catch (_) {} }
    polling.delete(account.id);
  }
};

// Pick all active accounts and run any whose interval has elapsed since lastPolledAt
const runDueAccounts = async () => {
  try {
    const accounts = await prisma.imapAccount.findMany({ where: { isActive: true } });
    const now = Date.now();
    for (const a of accounts) {
      const due = !a.lastPolledAt || (now - new Date(a.lastPolledAt).getTime()) >= (a.pollIntervalMs || 180000);
      if (due) pollAccount(a).catch(() => {});
    }
  } catch (err) {
    console.warn('[InboxPoll] tick failed:', err.message);
  }
};

// Run every account once, regardless of last poll time — used by manual "Fetch Now" endpoint
const pollAllAccounts = async () => {
  try {
    const accounts = await prisma.imapAccount.findMany({ where: { isActive: true } });
    for (const a of accounts) pollAccount(a).catch(() => {});
  } catch (err) {
    console.warn('[InboxPoll] manual run failed:', err.message);
  }
};

const startInboxPoll = () => {
  console.log('[InboxPoll] Scheduler started — checks every 60s, polls each account at its own interval');
  // Initial tick after 5s, then every minute
  setTimeout(() => { runDueAccounts().catch(() => {}); }, 5000);
  schedulerTimer = setInterval(() => { runDueAccounts().catch(() => {}); }, SCHEDULER_TICK_MS);
};

module.exports = { startInboxPoll, pollAllAccounts };
