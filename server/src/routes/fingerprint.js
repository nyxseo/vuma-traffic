const { prisma } = require("../db");
const express = require('express');
const router = express.Router();
const { authMiddleware, rateLimit } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');


// POST /api/fingerprint - Verify and get fingerprint
router.post('/', authMiddleware, rateLimit(30, 60000), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's plan
    const plan = await prisma.plan.findUnique({ where: { id: user.planId } });
    if (!plan || !plan.isVerifiedFingerprint) {
      return res.status(403).json({
        error: 'Fingerprint verification not available on your plan',
        requiredPlan: 'Starter or above',
      });
    }

    // Check fingerprint limit
    const fpCount = await prisma.fingerprint.count({
      where: { userId: user.id, isActive: true },
    });

    if (fpCount >= plan.fingerprintLimit && plan.fingerprintLimit < 999999) {
      return res.status(429).json({
        error: 'Fingerprint limit reached',
        current: fpCount,
        limit: plan.fingerprintLimit,
        message: 'Upgrade your plan for more fingerprints',
      });
    }

    const { fp, device, os, browser, ip } = req.body;

    // Check if fingerprint already exists
    let fingerprint = await prisma.fingerprint.findUnique({ where: { fp } });

    if (!fingerprint) {
      // Create new fingerprint
      fingerprint = await prisma.fingerprint.create({
        data: {
          userId: user.id,
          fp: fp || uuidv4(),
          device: device || 'unknown',
          os: os || 'unknown',
          browser: browser || 'unknown',
          isActive: true,
        },
      });

      // Log
      await prisma.log.create({
        data: {
          userId: user.id,
          action: 'fingerprint_create',
          detail: `New fingerprint: ${fingerprint.fp}`,
          ip: ip || req.ip,
        },
      });
    }

    // Update user last active
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });

    res.json({
      verified: true,
      fingerprint: {
        id: fingerprint.id,
        fp: fingerprint.fp,
        device: fingerprint.device,
        os: fingerprint.os,
        browser: fingerprint.browser,
      },
      usage: {
        current: fpCount + (fingerprint.createdAt > new Date(Date.now() - 1000) ? 1 : 0),
        limit: plan.fingerprintLimit,
      },
    });
  } catch (error) {
    console.error('Fingerprint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/fingerprint/list - List user's fingerprints
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const fingerprints = await prisma.fingerprint.findMany({
      where: { userId: req.userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    const plan = await prisma.plan.findUnique({ where: { id: (await prisma.user.findUnique({ where: { id: req.userId } })).planId } });

    res.json({
      fingerprints,
      usage: {
        current: fingerprints.length,
        limit: plan?.fingerprintLimit || 5,
      },
    });
  } catch (error) {
    console.error('Fingerprint list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/fingerprint/:id - Delete a fingerprint
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const fp = await prisma.fingerprint.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!fp) {
      return res.status(404).json({ error: 'Fingerprint not found' });
    }

    await prisma.fingerprint.update({
      where: { id: fp.id },
      data: { isActive: false },
    });

    res.json({ message: 'Fingerprint deleted' });
  } catch (error) {
    console.error('Fingerprint delete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
