require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT) || 3000,
  host: process.env.HOST || '0.0.0.0',
  jwt: {
    secret: process.env.JWT_SECRET || 'vuma-dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '2m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
  app: {
    name: process.env.APP_NAME || 'Vuma Traffic',
    url: process.env.APP_URL || 'http://localhost:3000',
  },
};
