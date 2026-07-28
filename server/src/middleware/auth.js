const { prisma } = require("../db");
const { verifyToken } = require('../utils/jwt');

// JWT auth middleware for API requests
// Accepts: Authorization Bearer token OR adminToken cookie
function authMiddleware(req, res, next) {
  let token = null;

  // Priority 1: Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // Priority 2: adminToken cookie (for admin dashboard)
  else if (req.cookies && req.cookies.adminToken) {
    token = req.cookies.adminToken;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid token' });
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Token expired or invalid' });
  }

  // Attach user info to request
  req.userId = decoded.userId || decoded.email;
  req.user = decoded;
  next();
}

// Admin-only middleware
function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
  }
  next();
}

// Rate limit helper - simple in-memory
const rateLimits = new Map();
function rateLimit(maxRequests = 60, windowMs = 60000) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const key = `${ip}:${req.baseUrl}`;

    if (!rateLimits.has(key)) {
      rateLimits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    const limit = rateLimits.get(key);
    if (now > limit.resetAt) {
      limit.count = 1;
      limit.resetAt = now + windowMs;
      return next();
    }

    limit.count++;
    if (limit.count > maxRequests) {
      return res.status(429).json({ error: 'Too Many Requests' });
    }

    next();
  };
}

module.exports = { authMiddleware, adminMiddleware, rateLimit };
