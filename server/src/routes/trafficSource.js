const { prisma } = require("../db");
const express = require('express');
const router = express.Router();
const { authMiddleware, rateLimit } = require('../middleware/auth');


// POST /api/traffic-source - Get traffic sources based on user plan
router.post('/', authMiddleware, rateLimit(30, 60000), async (req, res) => {
  try {
    const { limit, category } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const plan = await prisma.plan.findUnique({ where: { id: user.planId } });
    if (!plan) {
      return res.status(403).json({ error: 'No plan assigned' });
    }

    // Build query based on plan
    const where = { isActive: true };

    // If user doesn't have search engine access, filter out search category
    if (!plan.isSearchEngine) {
      where.category = { not: 'search' };
    }

    // If category is specified, filter by it
    if (category) {
      where.category = category;
    }

    const sources = await prisma.trafficSource.findMany({
      where,
      orderBy: { id: 'asc' },
      take: limit || 50,
    });

    // Check daily traffic limit
    const hitLimit = plan.trafficLimitDaily;
    const hitsRemaining = hitLimit - user.totalHitsToday;

    // Update user last active
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });

    res.json({
      sources: sources.map((s) => ({
        url: s.url,
        name: s.name,
        category: s.category,
      })),
      plan: plan.name,
      limits: {
        trafficLimitDaily: hitLimit,
        trafficUsedToday: user.totalHitsToday,
        trafficRemaining: hitsRemaining > 0 ? hitsRemaining : 0,
        isUnlimited: hitLimit >= 999999999,
      },
    });
  } catch (error) {
    console.error('Traffic source error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/stats - Get user traffic stats
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const plan = await prisma.plan.findUnique({ where: { id: user.planId } });

    // Get today's logs
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayLogs = await prisma.log.count({
      where: {
        userId: user.id,
        createdAt: { gte: today },
      },
    });

    res.json({
      stats: {
        totalHitsToday: user.totalHitsToday,
        totalHitsAll: user.totalHitsAll,
        dataUsedToday: user.dataUsedToday,
        logCountToday: todayLogs,
        lastActiveAt: user.lastActiveAt,
      },
      limits: {
        trafficLimitDaily: plan?.trafficLimitDaily || 0,
        fingerprintLimit: plan?.fingerprintLimit || 0,
        threadLimit: plan?.threadLimit || 0,
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
