const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /gamification/leaderboard
const getLeaderboard = async (req, res) => {
  try {
    const { month, year } = req.query;
    const targetMonth = parseInt(month) || new Date().getMonth() + 1;
    const targetYear = parseInt(year) || new Date().getFullYear();

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    // Get all active sales reps and directors
    const users = await prisma.user.findMany({
      where: { role: { in: ['sales_rep', 'sales_director'] }, isActive: true },
      select: { id: true, name: true, role: true, commissionRate: true },
    });

    const leaderboard = await Promise.all(users.map(async (u) => {
      const [contracts, visits, clients, revenue, perfScore] = await Promise.all([
        prisma.contract.count({ where: { salesRepId: u.id, createdAt: { gte: startDate, lte: endDate } } }),
        prisma.visit.count({ where: { salesRepId: u.id, visitDate: { gte: startDate, lte: endDate } } }),
        prisma.client.count({ where: { salesRepId: u.id, createdAt: { gte: startDate, lte: endDate } } }),
        prisma.contract.aggregate({
          where: { salesRepId: u.id, status: 'approved', createdAt: { gte: startDate, lte: endDate } },
          _sum: { totalValue: true },
        }),
        prisma.performanceScore.findFirst({
          where: { userId: u.id, month: targetMonth, year: targetYear },
        }),
      ]);

      // Points calculation
      const points = (contracts * 50) + (visits * 10) + (clients * 30) + Math.round((revenue._sum.totalValue || 0) / 10000);

      return {
        ...u,
        stats: { contracts, visits, clients, revenue: revenue._sum.totalValue || 0 },
        points,
        rating: perfScore?.rating || null,
        ratingNotes: perfScore?.notes || null,
      };
    }));

    // Sort by points descending
    leaderboard.sort((a, b) => b.points - a.points);

    // Add rank
    leaderboard.forEach((u, i) => { u.rank = i + 1; });

    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /gamification/rate
const ratePerformance = async (req, res) => {
  try {
    const { userId, month, year, rating, notes } = req.body;
    if (!userId || !rating) return res.status(400).json({ message: 'userId and rating required' });

    const score = await prisma.performanceScore.upsert({
      where: { userId_month_year: { userId: parseInt(userId), month: parseInt(month), year: parseInt(year) } },
      create: {
        userId: parseInt(userId),
        ratedById: req.user.id,
        month: parseInt(month),
        year: parseInt(year),
        rating: parseInt(rating),
        notes: notes || null,
      },
      update: {
        rating: parseInt(rating),
        notes: notes || null,
        ratedById: req.user.id,
      },
    });

    res.json(score);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getLeaderboard, ratePerformance };
