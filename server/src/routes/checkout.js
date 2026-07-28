const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const config = require('../config');

const prisma = new PrismaClient();

// Middleware: extract user from token
async function authUser(req, res, next) {
  let token = null;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.vumaToken) {
    token = req.cookies.vumaToken;
  }
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Token expired' });
  }
}

// POST /api/checkout/create — Create checkout session
router.post('/create', authUser, async (req, res) => {
  try {
    const { planId } = req.body;
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (plan.priceMonthly === 0) return res.status(400).json({ error: 'Free plan cannot be purchased' });

    const user = await prisma.user.findUnique({ where: { id: req.userId } });

    // Check existing pending transaction
    const existing = await prisma.transaction.findFirst({
      where: { userId: user.id, planId, paymentStatus: 'pending' }
    });

    if (existing) {
      return res.json({ transaction: existing, message: 'Already has pending payment' });
    }

    // Create transaction record
    const transaction = await prisma.transaction.create({
      data: {
        userId: user.id,
        planId: plan.id,
        amount: plan.priceMonthly,
        paymentMethod: 'midtrans',
        paymentStatus: 'pending',
      }
    });

    // Try Midtrans integration (if SERVER_KEY is set)
    const midtransKey = process.env.MIDTRANS_SERVER_KEY;
    if (midtransKey) {
      try {
        const midtransClient = require('midtrans-client');
        const snap = new midtransClient.Snap({
          isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
          serverKey: midtransKey,
          clientKey: process.env.MIDTRANS_CLIENT_KEY || '',
        });

        const parameter = {
          transaction_details: {
            order_id: transaction.id,
            gross_amount: plan.priceMonthly,
          },
          credit_card: { secure: true },
          customer_details: {
            first_name: user.name,
            email: user.email,
          },
        };

        const midtransResponse = await snap.createTransaction(parameter);
        return res.json({
          transaction,
          redirect: midtransResponse.redirect_url,
          token: midtransResponse.token,
          payment_url: midtransResponse.redirect_url,
        });
      } catch (midtransErr) {
        console.error('Midtrans error:', midtransErr.message);
        // Fallback to manual payment
      }
    }

    // Fallback: manual payment instructions
    res.json({
      transaction,
      message: 'Manual transfer required',
      payment_info: {
        bank: 'BCA - 1234567890 - Vuma Traffic',
        amount: plan.priceMonthly,
      },
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/payment/callback — Midtrans webhook
router.post('/callback', async (req, res) => {
  try {
    const notification = req.body;

    // Parse Midtrans notification
    const transactionId = notification.order_id;
    const transactionStatus = notification.transaction_status;
    const fraudStatus = notification.fraud_status;

    let paymentStatus = 'pending';
    if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
      if (fraudStatus === 'accept') paymentStatus = 'paid';
    } else if (transactionStatus === 'pending') {
      paymentStatus = 'pending';
    } else if (['deny', 'cancel', 'expire'].includes(transactionStatus)) {
      paymentStatus = 'failed';
    }

    // Update transaction
    const transaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        paymentStatus,
        paidAt: paymentStatus === 'paid' ? new Date() : undefined,
      }
    });

    // If paid, upgrade user plan
    if (paymentStatus === 'paid') {
      await prisma.user.update({
        where: { id: transaction.userId },
        data: { planId: transaction.planId },
      });
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/payment/manual — Upload manual payment proof
router.post('/manual', authUser, async (req, res) => {
  try {
    const { transactionId } = req.body;
    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, userId: req.userId }
    });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    await prisma.transaction.update({
      where: { id: transactionId },
      data: { paymentStatus: 'pending' },
    });

    res.json({ message: 'Payment proof received. Waiting for admin confirmation.' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/user/transactions — User payment history
router.get('/transactions', authUser, async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      include: { plan: { select: { name: true } } },
    });
    res.json({ transactions });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
