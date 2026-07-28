# Vuma Server - Deployment Guide

## Quick Start (Development)

```bash
cd server
npm install
npx prisma db push
node prisma/seed.js
npm run dev
```

Server runs at http://localhost:3080

## Production Deployment

### 1. Server Setup (Ubuntu/Debian)

```bash
# Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
npm install -g pm2

# Install build tools (for Prisma)
sudo apt install -y build-essential
```

### 2. Upload & Configure

```bash
# Upload server/ and admin/ folders to your VPS
scp -r server/ admin/ user@your-server:/opt/vuma/

# SSH into server
ssh user@your-server
cd /opt/vuma/server

# Install dependencies
npm install --production

# Setup database
npx prisma db push
node prisma/seed.js

# Configure environment
cp .env.example .env
nano .env  # Edit JWT_SECRET, ADMIN_PASSWORD, etc.
```

### 3. Start with PM2

```bash
# Start server
pm2 start ecosystem.config.js --env production

# Save PM2 config
pm2 save

# Auto-start on boot
pm2 startup
```

### 4. Nginx Reverse Proxy + SSL

```bash
# Install Nginx
sudo apt install -y nginx

# Create config
sudo nano /etc/nginx/sites-available/vuma
```

```nginx
server {
    listen 80;
    server_name api.vuma.id;

    location / {
        proxy_pass http://127.0.0.1:3080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/vuma /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get SSL with Certbot
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.vuma.id
```

### 5. Update Client

Edit `package.json` in the vumatraffic client:

```json
"homepage": "https://api.vuma.id"
```

Or use the patch script:
```bash
node patch-client.js https://api.vuma.id
```

## Default Credentials

- **Admin Email:** admin@vuma.id
- **Admin Password:** admin123

**CHANGE THESE IN PRODUCTION!**

## API Endpoints Reference

```
Auth:
  POST /api/auth/register   - Register new user
  POST /api/auth/login      - Login
  POST /api/auth/refresh    - Refresh token
  GET  /api/auth/me         - Current user info

Traffic:
  POST /api/fingerprint     - Verify fingerprint
  POST /api/traffic-source  - Get traffic sources
  GET  /api/stats           - User stats

Admin:
  GET  /api/admin/stats     - Dashboard stats
  GET  /api/admin/users     - List users
  GET  /api/admin/users/:id - User detail
  POST /api/admin/users     - Create user
  PUT  /api/admin/users/:id - Update user
  PUT  /api/admin/users/:id/plan - Change user plan
  DELETE /api/admin/users/:id    - Delete user
  GET  /api/admin/plans     - List plans
  POST /api/admin/plans     - Create plan
  PUT  /api/admin/plans/:id - Update plan
  GET  /api/admin/transactions - List transactions
  POST /api/admin/transactions - Record payment
```
