#!/bin/bash
#===============================================
# OpLogica - PostgreSQL Setup Script
# Run this on your VPS (147.93.126.139)
#===============================================

echo "🚀 Installing PostgreSQL..."

# Update system
sudo apt update

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
echo "📦 Creating database and user..."

sudo -u postgres psql << EOF
-- Create user for OpLogica
CREATE USER oplogica_user WITH PASSWORD 'OpLogica_Secure_2026!';

-- Create database
CREATE DATABASE oplogica_db OWNER oplogica_user;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE oplogica_db TO oplogica_user;

-- Connect to database and setup
\c oplogica_db

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO oplogica_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO oplogica_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO oplogica_user;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

EOF

echo "✅ PostgreSQL installed and configured!"
echo ""
echo "📋 Connection Details:"
echo "   Host: localhost"
echo "   Port: 5432"
echo "   Database: oplogica_db"
echo "   User: oplogica_user"
echo "   Password: OpLogica_Secure_2026!"
echo ""
echo "🔗 Connection String:"
echo "   postgresql://oplogica_user:OpLogica_Secure_2026!@localhost:5432/oplogica_db"
echo ""
echo "Next step: Run 02-create-tables.sql"
