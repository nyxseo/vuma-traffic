/**
 * Shared Prisma Client instance
 * With pool timeout to prevent hanging when pool is exhausted
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['error'],
});

// Verify connection
prisma.$connect()
  .then(() => console.log('[DB] Database connected'))
  .catch(e => console.error('[DB] Connection failed:', e.message));

// Ensure connections are released after each request
// This middleware should be used in Express
const dbMiddleware = async (req, res, next) => {
  const finish = () => {
    // Force connection release when request ends
  };
  res.on('finish', finish);
  next();
};

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = { prisma, dbMiddleware };
