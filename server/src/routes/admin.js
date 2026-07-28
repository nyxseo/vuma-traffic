const { prisma } = require("../db");
const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { hashPassword } = require('../utils/password');


// All admin routes require auth + admin role
router.use(authMiddleware, adminMiddleware);

// ==================== DASHBOARD STATS ====================

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await prisma.user.count({ where: { role: 'user' } });
    const activeUsers = await prisma.user.count({ where: { role: 'user', status: 'active' } });
    const suspendedUsers = await prisma.user.count({ where: { role: 'user', status: 'suspended' } });
    const bannedUsers = await prisma.user.count({ where: { role: 'user', status: 'banned' } });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newUsersToday = await prisma.user.count({
      where: { createdAt: { gte: today } },
    });

    const totalTransactions = await prisma.transaction.count();
    const paidTransactions = await prisma.transaction.count({ where: { paymentStatus: 'paid' } });
    const pendingTransactions = await prisma.transaction.count({ where: { paymentStatus: 'pending' } });

    // Revenue
    const allPaid = await prisma.transaction.findMany({ where: { paymentStatus: 'paid' } });
    const totalRevenue = allPaid.reduce((sum, t) => sum + t.amount, 0);

    // Plan distribution
    const usersByPlan = await prisma.user.groupBy({
      by: ['planId'],
      where: { role: 'user' },
      _count: true,
    });

    // Recent logs
    const recentLogs = await prisma.log.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        suspended: suspendedUsers,
        banned: bannedUsers,
        newToday: newUsersToday,
      },
      transactions: {
        total: totalTransactions,
        paid: paidTransactions,
        pending: pendingTransactions,
        totalRevenue,
      },
      planDistribution: usersByPlan,
      recentLogs,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== USER MANAGEMENT ====================

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const { search, status, planId, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { role: 'user' };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }
    if (status) where.status = status;
    if (planId) where.planId = planId;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          name: true,
          email: true,
          planId: true,
          status: true,
          totalHitsToday: true,
          totalHitsAll: true,
          lastActiveAt: true,
          createdAt: true,
          machineId: true,
          ipAddress: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/users/:id
router.get('/users/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        email: true,
        planId: true,
        role: true,
        status: true,
        machineId: true,
        ipAddress: true,
        totalHitsToday: true,
        totalHitsAll: true,
        dataUsedToday: true,
        lastActiveAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const plan = await prisma.plan.findUnique({ where: { id: user.planId } });
    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const logs = await prisma.log.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json({ user, plan, transactions, logs });
  } catch (error) {
    console.error('Admin user detail error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/users
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, planId, status } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        planId: planId || 'free',
        status: status || 'active',
        role: 'user',
      },
    });

    res.status(201).json({ message: 'User created', user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    console.error('Admin create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/users/:id
router.put('/users/:id', async (req, res) => {
  try {
    const { name, email, planId, status, machineId } = req.body;
    const data = {};

    if (name) data.name = name;
    if (email) data.email = email;
    if (planId) data.planId = planId;
    if (status) data.status = status;
    if (machineId !== undefined) data.machineId = machineId;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ message: 'User updated', user: { id: user.id, name: user.name, email: user.email, planId: user.planId, status: user.status } });
  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/users/:id/plan - Change user's plan
router.put('/users/:id/plan', async (req, res) => {
  try {
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'planId is required' });
    }

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { planId },
    });

    res.json({ message: `User plan changed to "${plan.name}"`, user: { id: user.id, planId: user.planId } });
  } catch (error) {
    console.error('Admin change plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ error: 'Cannot delete admin users' });
    }

    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ message: 'User deleted' });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== PLAN MANAGEMENT ====================

// GET /api/admin/plans
router.get('/plans', async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    // Count users per plan
    const userCounts = await prisma.user.groupBy({
      by: ['planId'],
      _count: true,
    });
    const countMap = {};
    userCounts.forEach((uc) => { countMap[uc.planId] = uc._count; });

    const plansWithCount = plans.map((p) => ({
      ...p,
      platforms: JSON.parse(p.platforms || '[]'),
      searchEngines: JSON.parse(p.searchEngines || '[]'),
      userCount: countMap[p.id] || 0,
    }));

    res.json({ plans: plansWithCount });
  } catch (error) {
    console.error('Admin plans error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/plans/:id
router.get('/plans/:id', async (req, res) => {
  try {
    const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const userCount = await prisma.user.count({ where: { planId: plan.id } });

    res.json({
      plan: {
        ...plan,
        platforms: JSON.parse(plan.platforms || '[]'),
        searchEngines: JSON.parse(plan.searchEngines || '[]'),
        userCount,
      },
    });
  } catch (error) {
    console.error('Admin plan detail error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/plans
router.post('/plans', async (req, res) => {
  try {
    const {
      id, name, description, priceMonthly, priceYearly,
      trafficLimitDaily, fingerprintLimit, threadLimit,
      isProxyEnabled, isAdNetworksEnabled, isBoostRpmEnabled,
      isVerifiedFingerprint, isViewAds, isSearchEngine,
      platforms, searchEngines, sortOrder,
    } = req.body;

    if (!id || !name) {
      return res.status(400).json({ error: 'id and name are required' });
    }

    const plan = await prisma.plan.create({
      data: {
        id,
        name,
        description: description || '',
        priceMonthly: priceMonthly || 0,
        priceYearly: priceYearly || 0,
        trafficLimitDaily: trafficLimitDaily || 500,
        fingerprintLimit: fingerprintLimit || 5,
        threadLimit: threadLimit || 1,
        isProxyEnabled: isProxyEnabled || false,
        isAdNetworksEnabled: isAdNetworksEnabled || false,
        isBoostRpmEnabled: isBoostRpmEnabled || false,
        isVerifiedFingerprint: isVerifiedFingerprint || false,
        isViewAds: isViewAds || false,
        isSearchEngine: isSearchEngine || false,
        platforms: JSON.stringify(platforms || []),
        searchEngines: JSON.stringify(searchEngines || []),
        sortOrder: sortOrder || 0,
      },
    });

    res.status(201).json({ message: 'Plan created', plan: { id: plan.id, name: plan.name } });
  } catch (error) {
    console.error('Admin create plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/plans/:id
router.put('/plans/:id', async (req, res) => {
  try {
    const existing = await prisma.plan.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const data = { ...req.body };
    if (data.platforms) data.platforms = JSON.stringify(data.platforms);
    if (data.searchEngines) data.searchEngines = JSON.stringify(data.searchEngines);

    // Don't update id
    delete data.id;

    const plan = await prisma.plan.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ message: 'Plan updated', plan: { id: plan.id, name: plan.name } });
  } catch (error) {
    console.error('Admin update plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/plans/:id
router.delete('/plans/:id', async (req, res) => {
  try {
    const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Check if any users are on this plan
    const userCount = await prisma.user.count({ where: { planId: plan.id } });
    if (userCount > 0) {
      return res.status(400).json({ error: `Cannot delete plan with ${userCount} active users. Migrate them first.` });
    }

    await prisma.plan.delete({ where: { id: req.params.id } });
    res.json({ message: 'Plan deleted' });
  } catch (error) {
    console.error('Admin delete plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== TRANSACTION MANAGEMENT ====================

// GET /api/admin/transactions
router.get('/transactions', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status) where.paymentStatus = status;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
        include: { user: { select: { name: true, email: true } }, plan: { select: { name: true } } },
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Admin transactions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/transactions - Record a manual payment
router.post('/transactions', async (req, res) => {
  try {
    const { userId, planId, amount, paymentMethod, notes } = req.body;

    if (!userId || !planId) {
      return res.status(400).json({ error: 'userId and planId are required' });
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId,
        planId,
        amount: amount || 0,
        paymentMethod: paymentMethod || 'manual',
        paymentStatus: 'paid',
        notes: notes || '',
        paidAt: new Date(),
      },
    });

    // Auto-assign plan to user
    await prisma.user.update({
      where: { id: userId },
      data: { planId },
    });

    res.status(201).json({ message: 'Transaction recorded and plan assigned', transaction });
  } catch (error) {
    console.error('Admin create transaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/transactions/:id - Update payment status
router.put('/transactions/:id', async (req, res) => {
  try {
    const { paymentStatus } = req.body;

    const data = { paymentStatus };
    if (paymentStatus === 'paid') {
      data.paidAt = new Date();
    }

    const transaction = await prisma.transaction.update({
      where: { id: req.params.id },
      data,
    });

    // If payment is confirmed, assign plan
    if (paymentStatus === 'paid') {
      await prisma.user.update({
        where: { id: transaction.userId },
        data: { planId: transaction.planId },
      });
    }

    res.json({ message: 'Transaction updated', transaction });
  } catch (error) {
    console.error('Admin update transaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
