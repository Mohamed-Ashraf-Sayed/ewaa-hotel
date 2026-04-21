const { PrismaClient } = require('@prisma/client');
const { getSubordinateIds } = require('../middleware/auth');
const prisma = new PrismaClient();

// GET /messages/contacts — list users available to chat with based on hierarchy
const getContacts = async (req, res) => {
  try {
    const me = req.user;
    let where = {};

    let baseIds = new Set();
    if (me.role === 'admin' || me.role === 'general_manager' || me.role === 'vice_gm') {
      const all = await prisma.user.findMany({ where: { isActive: true, NOT: { id: me.id } }, select: { id: true } });
      all.forEach(u => baseIds.add(u.id));
    } else if (me.role === 'sales_director') {
      const subIds = await getSubordinateIds(me.id);
      [...subIds, me.managerId].filter(Boolean).forEach(id => baseIds.add(id));
    } else if (me.role === 'assistant_sales' && me.managerId) {
      const teamIds = await getSubordinateIds(me.managerId);
      [me.managerId, ...teamIds.filter(id => id !== me.id)].forEach(id => baseIds.add(id));
    } else if (me.managerId) {
      const siblings = await prisma.user.findMany({
        where: { managerId: me.managerId, isActive: true, NOT: { id: me.id } },
        select: { id: true }
      });
      [me.managerId, ...siblings.map(s => s.id)].forEach(id => baseIds.add(id));
    }

    // Include anyone who has had a message conversation with me (so admins/anyone outside hierarchy still appear)
    const conversationPartners = await prisma.message.findMany({
      where: { OR: [{ fromUserId: me.id }, { toUserId: me.id }] },
      select: { fromUserId: true, toUserId: true },
    });
    conversationPartners.forEach(m => {
      if (m.fromUserId !== me.id) baseIds.add(m.fromUserId);
      if (m.toUserId !== me.id) baseIds.add(m.toUserId);
    });

    const contacts = await prisma.user.findMany({
      where: { isActive: true, id: { in: Array.from(baseIds) } },
      select: { id: true, name: true, role: true, email: true },
      orderBy: { name: 'asc' },
    });

    // Get last message + unread count for each contact
    const enriched = await Promise.all(contacts.map(async (c) => {
      const lastMsg = await prisma.message.findFirst({
        where: {
          OR: [
            { fromUserId: me.id, toUserId: c.id },
            { fromUserId: c.id, toUserId: me.id },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
      const unreadCount = await prisma.message.count({
        where: { fromUserId: c.id, toUserId: me.id, isRead: false },
      });
      return { ...c, lastMessage: lastMsg, unreadCount };
    }));

    // Sort by last message time desc, then by name
    enriched.sort((a, b) => {
      if (!a.lastMessage && !b.lastMessage) return 0;
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt);
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /messages/with/:userId — get conversation with a user
const getConversation = async (req, res) => {
  try {
    const otherUserId = parseInt(req.params.userId);
    const me = req.user;

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { fromUserId: me.id, toUserId: otherUserId },
          { fromUserId: otherUserId, toUserId: me.id },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    // Mark received messages as read
    await prisma.message.updateMany({
      where: { fromUserId: otherUserId, toUserId: me.id, isRead: false },
      data: { isRead: true },
    });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /messages — send a message (with optional attachment)
const sendMessage = async (req, res) => {
  try {
    const { toUserId, content } = req.body;
    if (!toUserId) {
      return res.status(400).json({ message: 'toUserId is required' });
    }
    if (!req.file && (!content || !content.trim())) {
      return res.status(400).json({ message: 'content or file is required' });
    }

    const data = {
      fromUserId: req.user.id,
      toUserId: parseInt(toUserId),
      content: (content || '').trim(),
    };
    if (req.file) {
      data.attachmentUrl = `/uploads/${req.file.filename}`;
      data.attachmentName = req.file.originalname;
      data.attachmentType = req.file.mimetype;
    }

    const msg = await prisma.message.create({ data });
    res.json(msg);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /messages/broadcast — send same message to all team members (director only)
const broadcast = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'content is required' });
    }

    let recipients = [];
    if (req.user.role === 'sales_director') {
      const subIds = await getSubordinateIds(req.user.id);
      recipients = subIds;
    } else if (['admin', 'general_manager', 'vice_gm'].includes(req.user.role)) {
      const all = await prisma.user.findMany({
        where: { isActive: true, NOT: { id: req.user.id } },
        select: { id: true },
      });
      recipients = all.map(u => u.id);
    } else {
      return res.status(403).json({ message: 'Not authorized to broadcast' });
    }

    const messages = await Promise.all(recipients.map(toUserId =>
      prisma.message.create({
        data: { fromUserId: req.user.id, toUserId, content: content.trim() },
      })
    ));

    res.json({ count: messages.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /messages/unread-count — total unread messages
const getUnreadCount = async (req, res) => {
  try {
    const count = await prisma.message.count({
      where: { toUserId: req.user.id, isRead: false },
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getContacts, getConversation, sendMessage, broadcast, getUnreadCount };
