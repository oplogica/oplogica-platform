# ═══════════════════════════════════════════════════════════════
# OpLogica Deployment Guide
# Complete setup instructions for VPS
# ═══════════════════════════════════════════════════════════════

## 📋 Overview

This guide will help you deploy OpLogica with:
- PostgreSQL database (on your server)
- Node.js backend with Auth & Stripe
- Full API functionality

## 🔧 Prerequisites

- VPS with Ubuntu 24.04 (you have this ✅)
- Node.js 18+ installed
- Domain pointing to server (oplogica.com ✅)
- Nginx configured (✅)

---

## Step 1: Install PostgreSQL

```bash
# SSH into your server
ssh root@147.93.126.139

# Run the setup script
chmod +x 01-postgres-setup.sh
./01-postgres-setup.sh
```

Or manually:
```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

---

## Step 2: Create Database & Tables

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create user and database
CREATE USER oplogica_user WITH PASSWORD 'OpLogica_Secure_2026!';
CREATE DATABASE oplogica_db OWNER oplogica_user;
GRANT ALL PRIVILEGES ON DATABASE oplogica_db TO oplogica_user;
\q

# Run the tables script
sudo -u postgres psql -d oplogica_db -f 02-create-tables.sql
```

---

## Step 3: Deploy Server Code

```bash
# Navigate to your app directory
cd /var/www/oplogica-com

# Backup current server
cp -r server server_backup

# Upload new server files (or copy via SFTP)
# Files needed:
#   - server/index.js
#   - server/package.json
#   - server/.env

# Install dependencies
cd server
npm install
```

---

## Step 4: Configure Environment

```bash
# Create .env file
nano /var/www/oplogica-com/server/.env

# Add these values:
PORT=3001
APP_URL=https://oplogica.com
DATABASE_URL=postgresql://oplogica_user:OpLogica_Secure_2026!@localhost:5432/oplogica_db
JWT_SECRET=generate-a-random-64-char-string-here
ANTHROPIC_API_KEY=your-anthropic-key

# For Stripe (add after creating products in Stripe Dashboard):
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_PRICE_PRO_MONTHLY=price_xxxxx
# etc...
```

---

## Step 5: Test Database Connection

```bash
# Test PostgreSQL connection
psql postgresql://oplogica_user:OpLogica_Secure_2026!@localhost:5432/oplogica_db -c "SELECT 1"

# Should return:
#  ?column?
# ----------
#        1
```

---

## Step 6: Restart Server

```bash
# Restart with PM2
pm2 restart oplogica

# Check logs
pm2 logs oplogica --lines 20

# Check health endpoint
curl https://oplogica.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "database": "connected",
  "version": "2.0.0"
}
```

---

## Step 7: Setup Stripe Products

In Stripe Dashboard (https://dashboard.stripe.com):

1. **Create Products:**
   - Pro Plan ($19/mo, $190/year)
   - Researcher Plan ($39/mo, $390/year)
   - Enterprise Plan ($199/mo, $1990/year)

2. **Get Price IDs** and add to .env

3. **Setup Webhook:**
   - URL: https://oplogica.com/api/stripe/webhook
   - Events: 
     - checkout.session.completed
     - customer.subscription.updated
     - customer.subscription.deleted
     - invoice.payment_failed

4. **Get Webhook Secret** and add to .env

---

## Step 8: Test Everything

### Test Sign Up:
```bash
curl -X POST https://oplogica.com/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123","full_name":"Test User"}'
```

### Test Sign In:
```bash
curl -X POST https://oplogica.com/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'
```

### Test AI (with token):
```bash
curl -X POST https://oplogica.com/api/ai/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"message":"Hello","mode":"quick"}'
```

---

## 📁 File Structure

```
/var/www/oplogica-com/
├── public/
│   ├── index.html      # Landing page
│   ├── chat.html       # Chat interface
│   └── success.html    # Payment success page
├── server/
│   ├── index.js        # Main server
│   ├── package.json    # Dependencies
│   └── .env            # Environment variables
└── package.json
```

---

## 🔒 Security Checklist

- [ ] Change default database password
- [ ] Generate strong JWT_SECRET
- [ ] Use HTTPS only (Let's Encrypt ✅)
- [ ] Set up firewall (ufw)
- [ ] Regular backups

---

## 🚨 Troubleshooting

### Database connection failed:
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check user permissions
sudo -u postgres psql -c "\du"
```

### Server won't start:
```bash
# Check logs
pm2 logs oplogica --lines 50

# Check Node version
node --version  # Should be 18+
```

### Stripe webhook fails:
```bash
# Check webhook secret matches
# Test with Stripe CLI:
stripe listen --forward-to localhost:3001/api/stripe/webhook
```

---

## ✅ Deployment Complete!

Your OpLogica server should now have:
- ✅ PostgreSQL database
- ✅ User authentication (JWT)
- ✅ Conversation storage
- ✅ Usage limits
- ✅ Stripe subscriptions

---

## 📞 Need Help?

If you encounter issues, check:
1. PM2 logs: `pm2 logs oplogica`
2. PostgreSQL logs: `sudo tail -f /var/log/postgresql/postgresql-*-main.log`
3. Nginx logs: `sudo tail -f /var/log/nginx/error.log`
