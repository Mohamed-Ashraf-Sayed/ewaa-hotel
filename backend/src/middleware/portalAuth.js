const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Verifies a portal JWT (issued at /api/portal/auth/verify-otp).
// Internal CRM tokens carry { userId }; portal tokens carry { clientId, type: 'portal' }.
// The `type` claim prevents a leaked CRM token from being used to access portal data and vice versa.
const portalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'portal' || !decoded.clientId) {
      return res.status(401).json({ message: 'Invalid portal token' });
    }
    const client = await prisma.client.findUnique({
      where: { id: decoded.clientId },
      include: { salesRep: { select: { id: true, name: true, email: true, phone: true } } },
    });
    if (!client || !client.isActive) {
      return res.status(401).json({ message: 'Client not found or inactive' });
    }
    req.client = client;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

module.exports = { portalAuth };
