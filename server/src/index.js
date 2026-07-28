const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const { comparePassword } = require('./utils/password');
const config = require('./config');

// ============ GLOBAL ERROR HANDLERS (mencegah crash) ============
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err.message);
});

const { prisma } = require('./db');
const app = express();

// ============ BODY PARSER — HARUS DI ATAS ============
app.use(cors({ origin: config.cors.origin, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ============ DEBUG — log semua POST body ============
app.use((req, res, next) => {
  if (req.method === 'POST') {
    console.log(`[DEBUG] POST ${req.url} | Content-Type: ${req.headers['content-type']}`);
    console.log(`[DEBUG] Body:`, req.body);
  }
  next();
});

// ============ VIEW ENGINE ============
app.set('view engine', 'ejs');
app.set('views', [
  path.join(__dirname, '../../admin/views'),     // Admin dashboard templates
  path.join(__dirname, '../../admin/views/public'), // Public SaaS templates
]);
app.use('/admin/public', express.static(path.join(__dirname, '../../admin/public')));

// ============ TEST ENDPOINT ============
app.post('/api/test-body', (req, res) => {
  res.json({ received: req.body, contentType: req.headers['content-type'] });
});

// ============ HEALTH ============
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: config.app.name, timestamp: new Date().toISOString() });
});
app.get('/api', (req, res) => {
  res.json({ status: 'ok', app: config.app.name, timestamp: new Date().toISOString() });
});

// ============ API ROUTES ============
app.use('/api/auth', require('./routes/auth'));
app.use('/api/fingerprint', require('./routes/fingerprint'));
app.use('/api/traffic-source', require('./routes/trafficSource'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/checkout', require('./routes/checkout'));
app.use('/api/payment', require('./routes/checkout'));
app.use('/api/user', require('./routes/checkout'));

// ============ PUBLIC SAAS ROUTES ============
app.use('/', require('./routes/public'));

// ============ STATS (standalone /api/stats) ============
const { authMiddleware } = require('./middleware/auth');
app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const plan = await prisma.plan.findUnique({ where: { id: user.planId } });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayLogs = await prisma.log.count({
      where: { userId: user.id, createdAt: { gte: today } },
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

// ============ ADMIN DASHBOARD ============
app.get('/admin', (req, res) => res.render('login', { error: null }));
app.get('/admin/login', (req, res) => res.render('login', { error: null }));

app.post('/admin/login', async (req, res) => {
  try {
    const email = req.body.email;
    const password = req.body.password;
    console.log(`[LOGIN] email=${email} password=${password ? '***' : 'MISSING'}`);

    if (!email || !password) {
      return res.render('login', { error: 'Email dan password harus diisi' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'admin') {
      return res.render('login', { error: 'Email atau password salah' });
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return res.render('login', { error: 'Email atau password salah' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: 'admin' },
      config.jwt.secret,
      { expiresIn: '24h' }
    );
    res.cookie('adminToken', token, { httpOnly: true, maxAge: 86400000 });
    console.log(`[LOGIN] SUCCESS: ${email}`);
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('[LOGIN] ERROR:', error.message);
    res.render('login', { error: 'Login gagal: ' + error.message });
  }
});

// Admin auth
function adminAuth(req, res, next) {
  const token = req.cookies.adminToken;
  if (!token) return res.redirect('/admin');
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    if (decoded.role !== 'admin') return res.redirect('/admin');
    req.admin = decoded;
    next();
  } catch {
    res.clearCookie('adminToken');
    res.redirect('/admin');
  }
}

app.get('/admin/dashboard', adminAuth, (req, res) => {
  const adminToken = req.cookies.adminToken || '';
  res.render('dashboard', { admin: req.admin, adminToken });
});
app.get('/admin/logout', (req, res) => {
  res.clearCookie('adminToken');
  res.redirect('/admin');
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ============ START ============
app.listen(config.port, config.host, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║         ${config.app.name} Server            ║
  ║   API:    http://${config.host}:${config.port}/api   ║
  ║   Admin:  http://${config.host}:${config.port}/admin  ║
  ╚══════════════════════════════════════════╝
  `);
});

module.exports = app;
