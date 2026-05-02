// Background job that connects to a configured IMAP mailbox, fetches new
// messages, and stores any whose `From` matches a registered client.
//
// Configuration via environment variables:
//   IMAP_HOST       e.g. "outlook.office365.com" or "imap.gmail.com"
//   IMAP_PORT       e.g. 993 (defaults to 993)
//   IMAP_SECURE     "true"/"false" (defaults to true; TLS on port 993)
//   IMAP_USER       mailbox login (e.g. reservations@example.com)
//   IMAP_PASS       mailbox password / app password
//   IMAP_MAILBOX    folder to watch (defaults to "INBOX")
//   INBOX_POLL_INTERVAL_MS   poll interval in ms (defaults to 180000 = 3min)
//
// Behaviour: only emails whose sender matches a `Client.email` (case-insensitive)
// are persisted. Others are ignored. Each message is stored once (uses RFC822
// Message-ID for dedup).

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let pollTimer = null;
let isPolling = false;

const isEnabled = () => Boolean(process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASS);

const buildClient = () => {
  const { ImapFlow } = require('imapflow');
  return new ImapFlow({
    host: process.env.IMAP_HOST,
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    secure: (process.env.IMAP_SECURE || 'true') === 'true',
    auth: { user: process.env.IMAP_USER, pass: process.env.IMAP_PASS },
    logger: false,
  });
};

const safeText = (s) => (s == null ? null : String(s).slice(0, 500_000));

const pollOnce = async () => {
  if (isPolling) return;
  if (!isEnabled()) return;
  isPolling = true;

  let client;
  try {
    client = buildClient();
    await client.connect();

    const mailbox = process.env.IMAP_MAILBOX || 'INBOX';
    const lock = await client.getMailboxLock(mailbox);
    try {
      // Fetch only the most recent 200 messages (reverse) so we don't choke on
      // large mailboxes. Dedup by messageId means re-running is cheap.
      const status = await client.status(mailbox, { messages: true });
      const total = status.messages || 0;
      if (total === 0) return;
      const start = Math.max(1, total - 200);
      const range = `${start}:${total}`;

      // Cache client email lookup so we don't query DB per message
      const clients = await prisma.client.findMany({
        where: { isActive: true, email: { not: null } },
        select: { id: true, email: true, companyName: true },
      });
      const clientByEmail = new Map();
      for (const c of clients) {
        if (c.email) clientByEmail.set(c.email.trim().toLowerCase(), c);
      }
      if (clientByEmail.size === 0) return; // no clients with emails — nothing to match

      const { simpleParser } = require('mailparser');

      for await (const msg of client.fetch(range, { source: true, envelope: true, internalDate: true })) {
        try {
          const messageId = msg.envelope?.messageId || `<${msg.uid}@local>`;
          const exists = await prisma.inboxEmail.findUnique({ where: { messageId } });
          if (exists) continue;

          // Extract From email and check against client list before parsing the full body
          const fromAddr = (msg.envelope?.from && msg.envelope.from[0]) || null;
          const fromEmailRaw = fromAddr?.address || '';
          const fromEmail = fromEmailRaw.trim().toLowerCase();
          if (!fromEmail) continue;

          const matchedClient = clientByEmail.get(fromEmail);
          if (!matchedClient) continue; // only client emails go to the inbox

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
              toEmail: (msg.envelope?.to && msg.envelope.to[0]?.address) || process.env.IMAP_USER,
              subject: parsed.subject || msg.envelope?.subject || '(no subject)',
              bodyText: safeText(parsed.text),
              bodyHtml: safeText(parsed.html || null),
              receivedAt: msg.internalDate || new Date(),
              category: 'client',
              hasAttachments: attachments.length > 0,
              attachmentsJson: attachments.length > 0 ? JSON.stringify(attachments) : null,
              clientId: matchedClient.id,
            },
          });
          console.log(`[InboxPoll] Stored email from ${fromEmail} (client #${matchedClient.id})`);
        } catch (perMsgErr) {
          console.warn('[InboxPoll] Skip message:', perMsgErr.message);
        }
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    console.warn('[InboxPoll] Poll failed:', err.message);
  } finally {
    if (client) { try { await client.logout(); } catch (_) { /* swallow */ } }
    isPolling = false;
  }
};

const startInboxPoll = () => {
  if (!isEnabled()) {
    console.log('[InboxPoll] Disabled — set IMAP_HOST/IMAP_USER/IMAP_PASS to enable');
    return;
  }
  const interval = parseInt(process.env.INBOX_POLL_INTERVAL_MS || '180000', 10);
  console.log(`[InboxPoll] Started (interval: ${Math.round(interval / 1000)}s)`);
  // Initial poll after 5s, then on interval
  setTimeout(() => { pollOnce().catch(() => {}); }, 5000);
  pollTimer = setInterval(() => { pollOnce().catch(() => {}); }, interval);
};

module.exports = { startInboxPoll, pollOnce };
