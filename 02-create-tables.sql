--===============================================
-- OpLogica - Database Tables
-- Run after PostgreSQL is installed
--===============================================

-- Connect to database first:
-- sudo -u postgres psql -d oplogica_db

--===============================================
-- 1. USERS TABLE
--===============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    
    -- Subscription info
    plan VARCHAR(50) DEFAULT 'free', -- free, pro, researcher, enterprise
    plan_expires_at TIMESTAMP,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    
    -- Usage limits
    messages_today INTEGER DEFAULT 0,
    messages_reset_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Settings
    settings JSONB DEFAULT '{}',
    language VARCHAR(10) DEFAULT 'en',
    theme VARCHAR(20) DEFAULT 'dark',
    
    -- Auth
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
);

-- Index for faster email lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);

--===============================================
-- 2. CONVERSATIONS TABLE
--===============================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    title VARCHAR(255) DEFAULT 'New Conversation',
    mode VARCHAR(50) DEFAULT 'deep', -- quick, deep, research, verify, market
    language VARCHAR(10) DEFAULT 'en',
    
    is_pinned BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    message_count INTEGER DEFAULT 0,
    last_message_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC);

--===============================================
-- 3. MESSAGES TABLE
--===============================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    
    role VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
    content TEXT NOT NULL,
    
    -- Analysis metadata
    mode VARCHAR(50), -- which mode was used
    model VARCHAR(100), -- which AI model responded
    tokens_used INTEGER,
    
    -- For assistant messages
    analysis JSONB, -- structured analysis data
    sources JSONB, -- citations/sources used
    
    -- Attachments
    attachments JSONB, -- [{type, url, name}]
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

--===============================================
-- 4. SUBSCRIPTIONS TABLE
--===============================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    plan VARCHAR(50) NOT NULL, -- pro, researcher, enterprise
    status VARCHAR(50) DEFAULT 'active', -- active, canceled, expired, past_due
    
    -- Stripe info
    stripe_subscription_id VARCHAR(255),
    stripe_price_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    
    -- Billing period
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    canceled_at TIMESTAMP,
    
    -- Trial
    trial_start TIMESTAMP,
    trial_end TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

--===============================================
-- 5. USAGE TABLE (Daily tracking)
--===============================================
CREATE TABLE IF NOT EXISTS usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    date DATE DEFAULT CURRENT_DATE,
    
    -- Counts
    messages_count INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    images_generated INTEGER DEFAULT 0,
    documents_analyzed INTEGER DEFAULT 0,
    
    -- By mode
    quick_count INTEGER DEFAULT 0,
    deep_count INTEGER DEFAULT 0,
    research_count INTEGER DEFAULT 0,
    verify_count INTEGER DEFAULT 0,
    market_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint: one row per user per day
    UNIQUE(user_id, date)
);

-- Indexes
CREATE INDEX idx_usage_user_date ON usage(user_id, date DESC);

--===============================================
-- 6. API KEYS TABLE (For Enterprise)
--===============================================
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    key_hash VARCHAR(255) NOT NULL, -- hashed API key
    key_prefix VARCHAR(20) NOT NULL, -- first 8 chars for display
    name VARCHAR(255), -- user-given name
    
    -- Limits
    rate_limit INTEGER DEFAULT 100, -- requests per minute
    monthly_limit INTEGER DEFAULT 10000,
    requests_this_month INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);

--===============================================
-- 7. PAYMENTS TABLE (Audit log)
--===============================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    
    -- Stripe info
    stripe_payment_intent_id VARCHAR(255),
    stripe_invoice_id VARCHAR(255),
    
    -- Amount
    amount INTEGER NOT NULL, -- in cents
    currency VARCHAR(3) DEFAULT 'usd',
    
    -- Status
    status VARCHAR(50), -- succeeded, failed, pending, refunded
    
    -- Metadata
    description TEXT,
    metadata JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_stripe ON payments(stripe_payment_intent_id);

--===============================================
-- 8. SESSIONS TABLE (For JWT blacklist/tracking)
--===============================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    token_hash VARCHAR(255) NOT NULL,
    
    -- Device info
    user_agent TEXT,
    ip_address VARCHAR(45),
    device_type VARCHAR(50),
    
    -- Status
    is_valid BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

--===============================================
-- FUNCTIONS
--===============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to reset daily message count
CREATE OR REPLACE FUNCTION reset_daily_messages()
RETURNS void AS $$
BEGIN
    UPDATE users 
    SET messages_today = 0, 
        messages_reset_at = CURRENT_TIMESTAMP
    WHERE messages_reset_at < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Function to increment message count
CREATE OR REPLACE FUNCTION increment_message_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    current_count INTEGER;
BEGIN
    -- Reset if new day
    UPDATE users 
    SET messages_today = 0, 
        messages_reset_at = CURRENT_TIMESTAMP
    WHERE id = p_user_id 
    AND messages_reset_at < CURRENT_DATE;
    
    -- Increment and return
    UPDATE users 
    SET messages_today = messages_today + 1
    WHERE id = p_user_id
    RETURNING messages_today INTO current_count;
    
    RETURN current_count;
END;
$$ LANGUAGE plpgsql;

--===============================================
-- GRANT PERMISSIONS
--===============================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO oplogica_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO oplogica_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO oplogica_user;

--===============================================
-- DONE!
--===============================================
SELECT 'OpLogica database tables created successfully!' as status;
