const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const prisma = new PrismaClient();

// GET /clients/:clientId/attachments
const listAttachments = async (req, res) => {
  try {
    const attachments = await prisma.clientAttachment.findMany({
      where: { clientId: parseInt(req.params.clientId) },
      include: { uploadedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(attachments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /clients/:clientId/attachments
const uploadAttachment = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'لا يوجد ملف' });
    const { type, notes } = req.body;
    const att = await prisma.clientAttachment.create({
      data: {
        clientId: parseInt(req.params.clientId),
        uploadedById: req.user.id,
        type: type || 'other',
        fileName: req.file.originalname,
        fileUrl: `/uploads/${req.file.filename}`,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        notes: notes || null,
      },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });
    res.json(att);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /attachments/:id
const deleteAttachment = async (req, res) => {
  try {
    const att = await prisma.clientAttachment.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!att) return res.status(404).json({ message: 'Not found' });
    // Delete file
    const filePath = path.join(__dirname, '../..', att.fileUrl);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await prisma.clientAttachment.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /attachments/:id/download
const downloadAttachment = async (req, res) => {
  try {
    const att = await prisma.clientAttachment.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!att) return res.status(404).json({ message: 'Not found' });
    const filePath = path.join(__dirname, '../..', att.fileUrl);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File missing' });
    res.download(filePath, att.fileName);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { listAttachments, uploadAttachment, deleteAttachment, downloadAttachment };
