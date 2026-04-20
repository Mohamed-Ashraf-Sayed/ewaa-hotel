const express = require('express');
const router = express.Router();
const { listAttachments, uploadAttachment, deleteAttachment, downloadAttachment } = require('../controllers/attachmentController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/clients/:clientId/attachments', authenticate, listAttachments);
router.post('/clients/:clientId/attachments', authenticate, upload.single('file'), uploadAttachment);
router.delete('/attachments/:id', authenticate, deleteAttachment);
router.get('/attachments/:id/download', authenticate, downloadAttachment);

module.exports = router;
