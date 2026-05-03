const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Hide the password in API responses (never echo it back to the UI)
const sanitize = (a) => {
  if (!a) return a;
  const { password, ...rest } = a;
  return { ...rest, hasPassword: !!password };
};

const list = async (_req, res) => {
  try {
    const accounts = await prisma.imapAccount.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(accounts.map(sanitize));
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getOne = async (req, res) => {
  try {
    const a = await prisma.imapAccount.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!a) return res.status(404).json({ message: 'Not found' });
    res.json(sanitize(a));
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const create = async (req, res) => {
  try {
    const { label, host, port, secure, username, password, mailbox, isActive, captureAll, pollIntervalMs } = req.body;
    if (!label || !host || !username || !password) {
      return res.status(400).json({ message: 'label, host, username, password required' });
    }
    const a = await prisma.imapAccount.create({
      data: {
        label, host,
        port: port ? parseInt(port) : 993,
        secure: secure !== false,
        username, password,
        mailbox: mailbox || 'INBOX',
        isActive: isActive !== false,
        captureAll: !!captureAll,
        pollIntervalMs: pollIntervalMs ? parseInt(pollIntervalMs) : 180000,
      },
    });
    res.status(201).json(sanitize(a));
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const update = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { label, host, port, secure, username, password, mailbox, isActive, captureAll, pollIntervalMs } = req.body;
    const data = {};
    if (label !== undefined) data.label = label;
    if (host !== undefined) data.host = host;
    if (port !== undefined) data.port = parseInt(port);
    if (secure !== undefined) data.secure = !!secure;
    if (username !== undefined) data.username = username;
    if (password) data.password = password; // only update if provided
    if (mailbox !== undefined) data.mailbox = mailbox;
    if (isActive !== undefined) data.isActive = !!isActive;
    if (captureAll !== undefined) data.captureAll = !!captureAll;
    if (pollIntervalMs !== undefined) data.pollIntervalMs = parseInt(pollIntervalMs);
    const a = await prisma.imapAccount.update({ where: { id }, data });
    res.json(sanitize(a));
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const remove = async (req, res) => {
  try {
    await prisma.imapAccount.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const testConnection = async (req, res) => {
  try {
    const a = await prisma.imapAccount.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!a) return res.status(404).json({ message: 'Not found' });
    const { ImapFlow } = require('imapflow');
    const client = new ImapFlow({
      host: a.host, port: a.port, secure: a.secure,
      auth: { user: a.username, pass: a.password },
      logger: false,
    });
    try {
      await client.connect();
      const status = await client.status(a.mailbox, { messages: true, unseen: true });
      await client.logout();
      await prisma.imapAccount.update({ where: { id: a.id }, data: { lastError: null } });
      res.json({ ok: true, messages: status.messages || 0, unseen: status.unseen || 0 });
    } catch (e) {
      await prisma.imapAccount.update({ where: { id: a.id }, data: { lastError: e.message } });
      try { await client.logout(); } catch (_) {}
      res.status(400).json({ ok: false, message: e.message });
    }
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const pollNow = async (_req, res) => {
  try {
    const { pollAllAccounts } = require('../jobs/inboxPoll');
    pollAllAccounts().catch(() => {});
    res.json({ message: 'Poll triggered' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { list, getOne, create, update, remove, testConnection, pollNow };
