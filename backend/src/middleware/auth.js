const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  // Admin (IT) bypasses all role checks
  if (req.user.role === 'admin') return next();
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied: insufficient permissions' });
  }
  next();
};

// Get IDs of all subordinates recursively
const getSubordinateIds = async (userId) => {
  const directSubs = await prisma.user.findMany({
    where: { managerId: userId, isActive: true },
    select: { id: true }
  });
  let ids = directSubs.map(u => u.id);
  for (const sub of directSubs) {
    const deeper = await getSubordinateIds(sub.id);
    ids = ids.concat(deeper);
  }
  return ids;
};

// assistant_sales acts as a deputy of their manager: they inherit the
// manager's team scope (sees the same clients/visits/contracts/etc. the
// manager sees). Their personal id is still used for ownership of records
// they create.
const isManagerScope = (user) =>
  user.role === 'sales_director' || (user.role === 'assistant_sales' && !!user.managerId);

const getScopeUserId = (user) =>
  user.role === 'assistant_sales' && user.managerId ? user.managerId : user.id;

module.exports = { authenticate, authorize, getSubordinateIds, isManagerScope, getScopeUserId };
