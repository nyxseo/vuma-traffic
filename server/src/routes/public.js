const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Landing page
router.get('/', async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } });
    res.render('public/landing', { plans });
  } catch(e) {
    res.render('public/landing', { plans: [] });
  }
});

// Pricing page
router.get('/pricing', async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } });
    res.render('public/landing', { plans, section: 'pricing' });
  } catch(e) {
    res.render('public/landing', { plans: [] });
  }
});

// Register
router.get('/register', (req, res) => {
  const plan = req.query.plan || 'free';
  res.render('public/register', { plan });
});

// Login (user login)
router.get('/login', (req, res) => {
  res.render('public/login');
});

// User dashboard (protected)
router.get('/dashboard', async (req, res) => {
  // Check JWT from cookie
  let token = null;
  if (req.cookies && req.cookies.vumaToken) {
    token = req.cookies.vumaToken;
  }

  if (!token) {
    return res.redirect('/login');
  }

  try {
    const jwt = require('jsonwebtoken');
    const config = require('../config');
    const decoded = jwt.verify(token, config.jwt.secret);

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || user.status !== 'active') {
      return res.redirect('/login');
    }

    const plan = await prisma.plan.findUnique({ where: { id: user.planId } });
    const plans = await prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } });

    // Refresh token for the view
    const newToken = jwt.sign({ userId: user.id, email: user.email, role: user.role }, config.jwt.secret, { expiresIn: '24h' });

    res.render('public/dashboard-user', {
      user: { id: user.id, name: user.name, email: user.email, role: user.role, planId: user.planId },
      plan: plan || {},
      plans,
      token: newToken,
    });
  } catch(e) {
    res.redirect('/login');
  }
});

// Download page
router.get('/download', (req, res) => {
  res.redirect('https://github.com/eurika404/vumatraffic/releases');
});

// Sitemap for SEO
router.get('/sitemap.xml', (req, res) => {
  res.header('Content-Type', 'application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://traffic.nyxseo.com/</loc><priority>1.0</priority></url>
  <url><loc>https://traffic.nyxseo.com/pricing</loc><priority>0.9</priority></url>
  <url><loc>https://traffic.nyxseo.com/register</loc><priority>0.8</priority></url>
  <url><loc>https://traffic.nyxseo.com/login</loc><priority>0.7</priority></url>
</urlset>`);
});

// Robots.txt
router.get('/robots.txt', (req, res) => {
  res.header('Content-Type', 'text/plain');
  res.send('User-agent: *\nAllow: /\nSitemap: https://traffic.nyxseo.com/sitemap.xml');
});

module.exports = router;
