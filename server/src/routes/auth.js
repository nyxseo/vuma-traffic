const { prisma } = require("../db");
const express = require('express');
const router = express.Router();
const { hashPassword, comparePassword } = require('../utils/password');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../utils/jwt');
const { authMiddleware, rateLimit } = require('../middleware/auth');


// POST /api/auth/register
router.post('/register', rateLimit(20, 60000), async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check existing user
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Create user with free plan
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        planId: 'free',
        status: 'active',
        role: 'user',
      },
    });

    // Generate tokens
    const tokenPayload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Get plan details
    const plan = await prisma.plan.findUnique({ where: { id: user.planId } });

    // Log registration
    await prisma.log.create({
      data: { userId: user.id, action: 'register', ip: req.ip },
    });

    res.status(201).json({
      message: 'Registration successful',
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: plan?.name || 'Free',
        status: user.status,
      },
      plan: formatPlan(plan),
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', rateLimit(30, 60000), async (req, res) => {
  try {
    const { email, password, machineId, ip } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: `Account is ${user.status}` });
    }

    const validPassword = await comparePassword(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update machine info
    if (machineId || ip) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          machineId: machineId || user.machineId,
          ipAddress: ip || req.ip,
          lastActiveAt: new Date(),
        },
      });
    }

    // Generate tokens
    const tokenPayload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Get plan details
    const plan = await prisma.plan.findUnique({ where: { id: user.planId } });

    // Log login
    await prisma.log.create({
      data: { userId: user.id, action: 'login', ip: req.ip },
    });

    res.json({
      message: 'Login successful',
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: plan?.name || 'Free',
        status: user.status,
      },
      plan: formatPlan(plan),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const decoded = verifyToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    const tokenPayload = { userId: user.id, email: user.email, role: user.role };
    const newAccessToken = generateAccessToken(tokenPayload);

    res.json({ token: newAccessToken });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const plan = await prisma.plan.findUnique({ where: { id: user.planId } });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        plan: plan?.name || 'Free',
        status: user.status,
        totalHitsToday: user.totalHitsToday,
        totalHitsAll: user.totalHitsAll,
        lastActiveAt: user.lastActiveAt,
        createdAt: user.createdAt,
      },
      plan: formatPlan(plan),
    });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function formatPlan(plan) {
  if (!plan) return null;
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    priceMonthly: plan.priceMonthly,
    priceYearly: plan.priceYearly,
    trafficLimitDaily: plan.trafficLimitDaily,
    fingerprintLimit: plan.fingerprintLimit,
    threadLimit: plan.threadLimit,
    isProxyEnabled: plan.isProxyEnabled,
    isAdNetworksEnabled: plan.isAdNetworksEnabled,
    isBoostRpmEnabled: plan.isBoostRpmEnabled,
    isVerifiedFingerprint: plan.isVerifiedFingerprint,
    isViewAds: plan.isViewAds,
    isSearchEngine: plan.isSearchEngine,
    platforms: JSON.parse(plan.platforms || '[]'),
    searchEngines: JSON.parse(plan.searchEngines || '[]'),
  };
}

module.exports = router;
