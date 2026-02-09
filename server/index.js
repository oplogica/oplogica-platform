/**
 * ═══════════════════════════════════════════════════════════════
 * OpLogica - AI Decision Intelligence Platform
 * Main Server: Auth, Database, Free tier (guest 20 / registered 50 msgs)
 * ═══════════════════════════════════════════════════════════════
 */

require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const { sendVerificationEmail, sendWelcomeEmail } = require('./email');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const Anthropic = require('@anthropic-ai/sdk');
const { triageDecision } = require('./triageEngine');
const creditEngine = require('./creditEngine');
const hiringEngine = require('./hiringEngine');
const permitEngine = require('./permitEngine');
const { SYSTEM_PROMPT } = require('./systemPrompt');
const { detectLanguage, t } = require('./i18n');

const app = express();

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'oplogica-super-secret-key-2026';
const JWT_EXPIRES_IN = '7d';

const crypto = require('crypto');
const generateToken = () => crypto.randomBytes(32).toString('hex');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 
        'postgresql://oplogica_user:OpLogica_Secure_2026!@localhost:5432/oplogica_db'
});

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

// Guest usage: 20 messages per day per IP (in-memory, reset at midnight UTC)
const GUEST_LIMIT = 20;
const guestUsage = new Map(); // key: hashed IP, value: { count, date }
function getGuestKey(req) {
    const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
    return crypto.createHash('sha256').update(ip).digest('hex');
}
function getGuestUsage(req) {
    const key = getGuestKey(req);
    const today = new Date().toISOString().slice(0, 10);
    let entry = guestUsage.get(key);
    if (!entry || entry.date !== today) {
        entry = { count: 0, date: today };
        guestUsage.set(key, entry);
    }
    return entry;
}

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

app.use(cors());

// Documentation page — register before static and any catch-all so /docs always serves docs.html
app.get('/docs', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'docs.html'));
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ═══════════════════════════════════════════════════════════════
// AUTH MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Get user from database
        const result = await pool.query(
            'SELECT id, email, full_name, plan, messages_today, messages_reset_at FROM users WHERE id = $1',
            [decoded.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }
        
        req.user = result.rows[0];
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

// Optional auth - allows guests
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const result = await pool.query(
                'SELECT id, email, full_name, plan, messages_today, messages_reset_at FROM users WHERE id = $1',
                [decoded.userId]
            );
            if (result.rows.length > 0) {
                req.user = result.rows[0];
            }
        } catch (error) {
            // Invalid token, continue as guest
        }
    }
    next();
};

// ═══════════════════════════════════════════════════════════════
// PLAN LIMITS (free only: guest 20, registered 50)
// ═══════════════════════════════════════════════════════════════

const PLAN_LIMITS = {
    free: { messages_per_day: 50, modes: ['quick', 'deep', 'research', 'verify', 'market'] },
    guest: { messages_per_day: GUEST_LIMIT, modes: ['quick', 'deep'] }
};

const checkUsageLimit = async (user, req) => {
    if (user) {
        const limits = PLAN_LIMITS.free;
        const resetAt = new Date(user.messages_reset_at);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (resetAt < today) {
            await pool.query(
                'UPDATE users SET messages_today = 0, messages_reset_at = NOW() WHERE id = $1',
                [user.id]
            );
            user.messages_today = 0;
        }
        if (user.messages_today >= limits.messages_per_day) {
            return {
                allowed: false,
                message: `تم استهلاك الحد اليومي (${limits.messages_per_day} رسالة). يعاد التحديث يومياً.`,
                remaining: 0
            };
        }
        return { allowed: true, remaining: limits.messages_per_day - user.messages_today };
    }
    // Guest: track by IP
    const entry = getGuestUsage(req);
    if (entry.count >= GUEST_LIMIT) {
        return {
            allowed: false,
            message: `انتهت رسائلك المجانية (${GUEST_LIMIT}). سجّل دخولك أو أنشئ حساباً للحصول على 50 رسالة يومياً.`,
            remaining: 0
        };
    }
    return { allowed: true, remaining: GUEST_LIMIT - entry.count };
};

// ═══════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════

// Sign Up
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { email, password, full_name: fn, fullName } = req.body;
        const full_name = fn || fullName || '';
        
        // Validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        
        // Check if user exists
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email.toLowerCase()]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        
        // Create user
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, full_name, verification_token) 
             VALUES ($1, $2, $3, $4) 
             RETURNING id, email, full_name, plan, verification_token, created_at`,
            [email.toLowerCase(), password_hash, full_name || '', generateToken()]
        );
        
        const user = result.rows[0];
        sendVerificationEmail(user.email, user.full_name, user.verification_token).catch(err => console.error('Email error:', err));
        
        // Generate token
        
        res.status(201).json({
            message: "Account created! Please check your email to verify.",
            requiresVerification: true
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Failed to create account' });
    }
});

// Sign In
app.post('/api/auth/signin', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        
        // Find user
        const result = await pool.query(
            'SELECT id, email, password_hash, full_name, plan, email_verified FROM users WHERE email = $1',
            [email.toLowerCase()]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        const user = result.rows[0];
        
        // Check password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (user.email_verified === false) { return res.status(403).json({ error: 'Please verify your email first' }); }
        
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // Update last login
        await pool.query(
            'UPDATE users SET last_login_at = NOW() WHERE id = $1',
            [user.id]
        );
        
        // Generate token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
        
        res.json({
            message: 'Signed in successfully',
            token,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                plan: user.plan
            }
        });
        
    } catch (error) {
        console.error('Signin error:', error);
        res.status(500).json({ error: 'Failed to sign in' });
    }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, email, full_name, plan, plan_expires_at, 
                    messages_today, messages_reset_at, settings, language, theme, created_at
             FROM users WHERE id = $1`,
            [req.user.id]
        );
        const user = result.rows[0];
        const limits = PLAN_LIMITS.free;
        res.json({
            user: {
                ...user,
                messages_limit: limits.messages_per_day,
                available_modes: limits.modes
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// Update user settings
app.patch('/api/auth/settings', authenticateToken, async (req, res) => {
    try {
        const { full_name, language, theme, settings } = req.body;
        
        const updates = [];
        const values = [];
        let paramCount = 1;
        
        if (full_name !== undefined) {
            updates.push(`full_name = $${paramCount++}`);
            values.push(full_name);
        }
        if (language !== undefined) {
            updates.push(`language = $${paramCount++}`);
            values.push(language);
        }
        if (theme !== undefined) {
            updates.push(`theme = $${paramCount++}`);
            values.push(theme);
        }
        if (settings !== undefined) {
            updates.push(`settings = $${paramCount++}`);
            values.push(JSON.stringify(settings));
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }
        
        values.push(req.user.id);
        
        const result = await pool.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} 
             RETURNING id, email, full_name, language, theme, settings`,
            values
        );
        
        res.json({ user: result.rows[0] });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Change password
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        
        if (!current_password || !new_password) {
            return res.status(400).json({ error: 'Current and new password required' });
        }
        
        if (new_password.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters' });
        }
        
        // Get current password hash
        const result = await pool.query(
            'SELECT password_hash FROM users WHERE id = $1',
            [req.user.id]
        );
        
        // Verify current password
        const valid = await bcrypt.compare(current_password, result.rows[0].password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const new_hash = await bcrypt.hash(new_password, salt);
        
        // Update
        await pool.query(
            'UPDATE users SET password_hash = $1 WHERE id = $2',
            [new_hash, req.user.id]
        );
        
        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// ═══════════════════════════════════════════════════════════════
// CONVERSATIONS ROUTES
// ═══════════════════════════════════════════════════════════════

// Get all conversations for user
app.get('/api/conversations', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, title, mode, language, is_pinned, message_count, 
                    last_message_at, created_at, updated_at
             FROM conversations 
             WHERE user_id = $1 AND is_archived = FALSE
             ORDER BY is_pinned DESC, updated_at DESC
             LIMIT 50`,
            [req.user.id]
        );
        
        res.json({ conversations: result.rows });
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ error: 'Failed to get conversations' });
    }
});

// Create new conversation
app.post('/api/conversations', authenticateToken, async (req, res) => {
    try {
        const { title, mode, language } = req.body;
        
        const result = await pool.query(
            `INSERT INTO conversations (user_id, title, mode, language)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [req.user.id, title || 'New Conversation', mode || 'deep', language || 'en']
        );
        
        res.status(201).json({ conversation: result.rows[0] });
    } catch (error) {
        console.error('Create conversation error:', error);
        res.status(500).json({ error: 'Failed to create conversation' });
    }
});

// Get single conversation with messages
app.get('/api/conversations/:id', authenticateToken, async (req, res) => {
    try {
        // Get conversation
        const convResult = await pool.query(
            'SELECT * FROM conversations WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );
        
        if (convResult.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        
        // Get messages
        const msgResult = await pool.query(
            `SELECT id, role, content, mode, created_at
             FROM messages 
             WHERE conversation_id = $1
             ORDER BY created_at ASC`,
            [req.params.id]
        );
        
        res.json({
            conversation: convResult.rows[0],
            messages: msgResult.rows
        });
    } catch (error) {
        console.error('Get conversation error:', error);
        res.status(500).json({ error: 'Failed to get conversation' });
    }
});

// Update conversation
app.patch('/api/conversations/:id', authenticateToken, async (req, res) => {
    try {
        const { title, is_pinned, is_archived } = req.body;
        
        const updates = [];
        const values = [];
        let paramCount = 1;
        
        if (title !== undefined) {
            updates.push(`title = $${paramCount++}`);
            values.push(title);
        }
        if (is_pinned !== undefined) {
            updates.push(`is_pinned = $${paramCount++}`);
            values.push(is_pinned);
        }
        if (is_archived !== undefined) {
            updates.push(`is_archived = $${paramCount++}`);
            values.push(is_archived);
        }
        
        values.push(req.params.id, req.user.id);
        
        const result = await pool.query(
            `UPDATE conversations SET ${updates.join(', ')} 
             WHERE id = $${paramCount++} AND user_id = $${paramCount}
             RETURNING *`,
            values
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        
        res.json({ conversation: result.rows[0] });
    } catch (error) {
        console.error('Update conversation error:', error);
        res.status(500).json({ error: 'Failed to update conversation' });
    }
});

// Delete conversation
app.delete('/api/conversations/:id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM conversations WHERE id = $1 AND user_id = $2 RETURNING id',
            [req.params.id, req.user.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        
        res.json({ message: 'Conversation deleted' });
    } catch (error) {
        console.error('Delete conversation error:', error);
        res.status(500).json({ error: 'Failed to delete conversation' });
    }
});

// ═══════════════════════════════════════════════════════════════
// AI CHAT ROUTES (system prompt: server/systemPrompt.js — identity, compliance, critical Q&A)
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// TRIAGE INTENT DETECTION (chat intercept — same engine as /api/triage-demo)
// ═══════════════════════════════════════════════════════════════

function detectTriageRequest(message) {
    if (!message || typeof message !== 'string') return false;
    const lower = message.toLowerCase();
    const triageKeywords = ['triage', 'patient', 'vital score', 'vital_score',
        'comorbidity', 'wait time', 'medical assessment', 'triage assessment', 'patient case'];
    const triageKeywordsAR = ['تقييم طبي', 'فرز طبي', 'تصنيف طبي', 'حالة طبية', 'أولوية طبية',
        'علامات حيوية', 'تقييم المريض', 'طوارئ طبية', 'فحص طبي عاجل', 'تقييم الفرز'];
    const paramKeywords = ['vital', 'age', 'comorbidity', 'wait', 'resource', 'priority', 'critical'];
    const hasTriageKeyword = triageKeywords.some(k => lower.includes(k));
    const hasArabicTriage = triageKeywordsAR.some(k => message.includes(k));
    const paramCount = paramKeywords.filter(k => lower.includes(k)).length;
    const result = hasTriageKeyword || hasArabicTriage || paramCount >= 3;
    if (process.env.TRIAGE_DEBUG) {
        console.log('[TRIAGE] detectTriageRequest:', { hasTriageKeyword, hasArabicTriage, paramCount, result, preview: String(message).substring(0, 80) });
    }
    return result;
}

function extractPatientParams(message) {
    if (!message || typeof message !== 'string') return {};
    const patterns = {
        vital_score: /(?:vital[_\s]*score|درجة[_\s]*العلامات[_\s]*الحيوية|علامات[_\s]*حيوية)[:\s=]*([0-9]*\.?[0-9]+)/i,
        age: /(?:age|العمر|عمر)[:\s=]*(\d+)/i,
        comorbidity_index: /(?:comorbidity[_\s]*(?:index)?|مؤشر[_\s]*الأمراض[_\s]*المصاحبة|أمراض[_\s]*مصاحبة)[:\s=]*([0-9]*\.?[0-9]+)/i,
        wait_time: /(?:wait[_\s]*time|وقت[_\s]*الانتظار|انتظار)[:\s=]*(\d+)/i,
        resource_score: /(?:resource[_\s]*score|درجة[_\s]*الموارد|موارد)[^:]*[:\s=]+([0-9]*\.?[0-9]+)/i
    };
    const params = {};
    for (const [key, regex] of Object.entries(patterns)) {
        const match = message.match(regex);
        if (match) {
            const val = key === 'age' || key === 'wait_time' ? parseInt(match[1], 10) : parseFloat(match[1]);
            if (!Number.isNaN(val)) params[key] = val;
        }
    }
    return params;
}

function formatTriageResponse(result, lang) {
    lang = lang || 'en';
    const dir = lang === 'ar' ? ' dir="rtl"' : '';
    const s = (key) => t('shared', key, lang);
    const m = (key) => t('triage', key, lang);
    const d = result.decision;
    const vb = result.verification_bundle;

    const priorityIcons = { HIGH: '🔴', MEDIUM: '🟠', LOW: '🟢' };
    const icon = priorityIcons[d.priority] || '⚪';
    const priorityLabel = d.priority === 'HIGH' ? m('highPriority') : d.priority === 'MEDIUM' ? m('mediumPriority') : m('lowPriority');
    const prioritySub = d.priority === 'HIGH' ? m('highPrioritySub') : d.priority === 'MEDIUM' ? m('mediumPrioritySub') : m('lowPrioritySub');

    let response = `<div${dir}>\n\n`;
    response += `## ${s('triadicTitle')} — ${m('systemTitle')}\n\n`;
    response += `<div class="triage-priority-badge priority-${d.priority}">\n<span class="priority-icon">${icon}</span>\n<span class="priority-label">${priorityLabel}</span>\n<span class="priority-sub">${prioritySub}</span>\n</div>\n\n`;
    response += `| ${s('parameter')} | ${s('value')} |\n|---|---|\n`;
    response += `| ${m('critical')} | ${d.critical ? '✅ ' + m('yes') : '❌ ' + m('no')} |\n`;
    response += `| ${m('urgency')} | ${d.urgency} |\n`;
    response += `| ${m('reassessment')} | ${d.reassessment ? '⚠️ ' + m('required') : m('notRequired')} |\n\n`;
    response += `### ${s('reasoningChain')}\n\n`;
    response += `| # | ${s('ruleHeader')} | ${s('inputHeader')} | ${s('resultHeader')} |\n|---|------|-------|--------|\n`;
    (d.allRules || []).forEach(r => {
        const resultCell = r.triggered ? '✅ ' + s('triggered') : s('notTriggered');
        response += `| ${r.id} | ${r.rule} | ${r.detail || ''} | ${resultCell} |\n`;
    });
    response += `\n### ${s('reasonGraph')}\n\n`;
    const graph = vb.por.graph;
    const graphJson = JSON.stringify(graph).replace(/"/g, '&quot;');
    response += `<div class="triage-reason-graph" data-graph="${graphJson}"></div>\n\n`;
    response += `<details>\n<summary>🔐 ${s('pooTitle')}</summary>\n\n`;
    response += `- **${s('hash')}:** \`${vb.poo.hash}\`\n`;
    response += `- **${s('timestamp')}:** ${vb.poo.timestamp}\n`;
    response += `- **${s('algorithm')}:** ${vb.poo.algorithm}\n`;
    response += `- **${s('signature')}:** \`${String(vb.poo.signature).substring(0, 32)}...\`\n\n</details>\n\n`;
    response += `<details>\n<summary>📐 ${s('porTitle')}</summary>\n\n`;
    const verts = (vb.por.graph.vertices || []);
    response += `- **${s('vertices')}:** ${verts.length} (${verts.filter(v => v.type === 'premise').length} ${s('premises')}, ${verts.filter(v => v.type === 'rule').length} ${s('rules')}, ${verts.filter(v => v.type === 'conclusion').length} ${s('conclusions')})\n`;
    response += `- **${s('edges')}:** ${(vb.por.graph.edges || []).length} ${s('inferenceRelationships')}\n`;
    response += `- **${s('graphHash')}:** \`${vb.por.hash}\`\n\n</details>\n\n`;
    response += `<details>\n<summary>🎯 ${s('poiTitle')}</summary>\n\n`;
    response += `- **${s('policy')}:** ${m('policyName')}\n`;
    response += `- **${s('declared')}:** ${vb.poi.declaration_time || ''}\n\n`;
    response += `| ${s('constraint')} | ${s('status')} |\n|---|---|\n`;
    (vb.poi.results || []).forEach(r => {
        const statusCell = r.detail || (r.satisfied ? '✅' : '❌');
        response += `| ${r.constraint} | ${statusCell} |\n`;
    });
    response += `\n</details>\n\n`;
    const verified = vb.overall_result === 'VERIFIED';
    response += `<div class="verification-status-bar">\n`;
    response += `<div class="status-item ${verified ? 'verified' : ''}"><span class="status-icon">🔐</span><span class="status-label">PoO</span><span class="status-check">✓</span></div>\n`;
    response += `<div class="status-connector">→</div>\n`;
    response += `<div class="status-item ${verified ? 'verified' : ''}"><span class="status-icon">📐</span><span class="status-label">PoR</span><span class="status-check">✓</span></div>\n`;
    response += `<div class="status-connector">→</div>\n`;
    response += `<div class="status-item ${verified ? 'verified' : ''}"><span class="status-icon">🎯</span><span class="status-label">PoI</span><span class="status-check">✓</span></div>\n`;
    response += `<div class="status-connector">=</div>\n`;
    response += `<div class="status-item final ${verified ? 'verified' : ''}"><span class="status-label">${s('verified')}</span></div>\n`;
    response += `</div>\n\n`;
    response += `<small style="color:#4e5563;display:block;margin-top:12px;text-align:center;">${s('disclaimer')}</small>\n\n`;
    response += `</div>`;
    return response;
}

// ═══════════════════════════════════════════════════════════════
// CREDIT ASSESSMENT INTENT DETECTION (chat intercept — after triage)
// ═══════════════════════════════════════════════════════════════

function detectCreditRequest(message) {
    if (!message || typeof message !== 'string') return false;
    const lower = message.toLowerCase();
    const creditKeywords = ['credit assessment', 'loan application', 'credit score', 'loan evaluation',
        'debt to income', 'credit evaluation', 'loan request', 'mortgage assessment', 'credit analysis'];
    const creditKeywordsAR = ['تقييم ائتمان', 'تقييم قرض', 'طلب قرض', 'تقييم مالي',
        'درجة ائتمانية', 'نسبة الدين', 'تقييم الائتمان', 'فحص مالي', 'تمويل'];
    const hasKeyword = creditKeywords.some(k => lower.includes(k));
    const hasArabicCredit = creditKeywordsAR.some(k => message.includes(k));
    const terms = ['credit', 'income', 'debt', 'loan', 'dti', 'fico', 'score', 'employment', 'annual', 'mortgage'];
    const termCount = terms.filter(t => lower.includes(t)).length;
    return hasKeyword || hasArabicCredit || termCount >= 3;
}

function extractNumber(message, regex) {
    if (!message || typeof message !== 'string') return undefined;
    const match = message.match(regex);
    if (!match || !match[1]) return undefined;
    const num = parseInt(match[1].replace(/,/g, ''), 10);
    return Number.isNaN(num) ? undefined : num;
}

function extractFloat(message, regex) {
    if (!message || typeof message !== 'string') return undefined;
    const match = message.match(regex);
    if (!match || !match[1]) return undefined;
    const num = parseFloat(match[1]);
    return Number.isNaN(num) ? undefined : num;
}

function extractCreditParams(message) {
    if (!message || typeof message !== 'string') return {};
    return {
        credit_score: extractNumber(message, /credit[_\s]*score[:\s=]*(\d+)/i) ||
            extractNumber(message, /fico[:\s=]*(\d+)/i) ||
            extractNumber(message, /(?:درجة[_\s]*(?:ال)?ائتمان(?:ية)?|الدرجة[_\s]*الائتمانية)[:\s=]*(\d+)/i),
        annual_income: extractNumber(message, /(?:annual[_\s]*income|الدخل[_\s]*السنوي|دخل[_\s]*سنوي)[:\s=]*\$?(\d[\d,]*)/i) ||
            extractNumber(message, /(?:annual[_\s]*)?income[:\s=]*\$?(\d[\d,]*)/i),
        debt_to_income: extractFloat(message, /(?:debt[_\s]*to[_\s]*income|DTI|نسبة[_\s]*الدين|الدين[_\s]*إلى[_\s]*الدخل)[_\s]*(?:ratio)?[:\s=]*([0-9]*\.?[0-9]+)/i) ||
            extractFloat(message, /(?:debt[_\s]*to[_\s]*income|dti)[_\s]*(?:ratio)?[:\s=]*([0-9]*\.?[0-9]+)/i),
        loan_amount: extractNumber(message, /(?:loan[_\s]*(?:amount)?|مبلغ[_\s]*القرض|قيمة[_\s]*القرض)[:\s=]*\$?(\d[\d,]*)/i),
        employment_years: extractNumber(message, /(?:employment[_\s]*(?:years)?|سنوات[_\s]*العمل|خبرة[_\s]*عملية|سنوات[_\s]*الخبرة)[:\s=]*(\d+)/i) ||
            extractNumber(message, /(?:employment|employed|working)[_\s]*(?:years|yrs)?[:\s=]*(\d+)/i)
    };
}

function formatCreditResponse(result, lang) {
    lang = lang || 'en';
    const dir = lang === 'ar' ? ' dir="rtl"' : '';
    const s = (key) => t('shared', key, lang);
    const m = (key) => t('credit', key, lang);
    const d = result.decision;
    const vb = result.verification_bundle;
    const recIcons = { APPROVED: '🟢', DENIED: '🔴', MANUAL_REVIEW: '🟠' };
    const icon = recIcons[d.recommendation] || '⚪';
    const recLabel = d.recommendation === 'APPROVED' ? m('approved') : d.recommendation === 'DENIED' ? m('denied') : m('manualReview');
    const recSub = d.recommendation === 'APPROVED' ? m('approvedSub') : d.recommendation === 'DENIED' ? m('deniedSub') : m('manualReviewSub');

    let response = `<div${dir}>\n\n`;
    response += `## ${s('triadicTitle')} — ${m('systemTitle')}\n\n`;
    response += `<div class="triage-priority-badge priority-${d.recommendation}">\n<span class="priority-icon">${icon}</span>\n<span class="priority-label">${recLabel}</span>\n<span class="priority-sub">${recSub}</span>\n</div>\n\n`;
    response += `| ${s('parameter')} | ${s('value')} |\n|---|---|\n`;
    response += `| ${m('riskLevel')} | ${d.risk_level} |\n`;
    response += `| ${m('riskScore')} | ${d.risk_score} (0–100, lower = better) |\n`;
    response += `| ${m('interestTier')} | ${d.interest_rate_tier} |\n\n`;
    response += `### ${s('reasoningChain')}\n\n`;
    response += `| # | ${s('ruleHeader')} | ${s('resultHeader')} | ${s('inputHeader')} |\n|---|------|--------|-------|\n`;
    (d.allRules || []).forEach(r => {
        const trig = r.triggered ? '✅ ' + s('yes') : s('no');
        response += `| ${r.id} | ${r.rule} | ${trig} | ${r.detail || ''} |\n`;
    });
    response += `\n### ${s('reasonGraph')}\n\n`;
    const graph = vb.por.graph;
    const graphJson = JSON.stringify(graph).replace(/"/g, '&quot;');
    response += `<div class="triage-reason-graph" data-graph="${graphJson}"></div>\n\n`;
    response += `<details>\n<summary>🔐 ${s('pooTitle')}</summary>\n\n`;
    response += `- **${s('hash')}:** \`${vb.poo.hash}\`\n`;
    response += `- **${s('timestamp')}:** ${vb.poo.timestamp}\n`;
    response += `- **${s('signature')}:** \`${String(vb.poo.signature).substring(0, 32)}...\`\n\n</details>\n\n`;
    response += `<details>\n<summary>📐 ${s('porTitle')}</summary>\n\n`;
    const verts = (vb.por.graph.vertices || []);
    response += `- **${s('vertices')}:** ${verts.length} · **${s('edges')}:** ${(vb.por.graph.edges || []).length}\n`;
    response += `- **${s('graphHash')}:** \`${vb.por.hash}\`\n\n</details>\n\n`;
    response += `<details>\n<summary>🎯 ${s('poiTitle')}</summary>\n\n`;
    response += `- **${s('policy')}:** ${m('policyName')}\n`;
    (vb.poi.results || []).forEach(r => {
        response += `- ${r.constraint}: ${r.satisfied ? '✅' : '❌'} ${r.detail || ''}\n`;
    });
    response += `\n</details>\n\n`;
    const verified = vb.overall_result === 'VERIFIED';
    response += `<div class="verification-status-bar">\n`;
    response += `<div class="status-item ${verified ? 'verified' : ''}"><span class="status-icon">🔐</span><span class="status-label">PoO</span><span class="status-check">✓</span></div>\n`;
    response += `<div class="status-connector">→</div>\n`;
    response += `<div class="status-item ${verified ? 'verified' : ''}"><span class="status-icon">📐</span><span class="status-label">PoR</span><span class="status-check">✓</span></div>\n`;
    response += `<div class="status-connector">→</div>\n`;
    response += `<div class="status-item ${verified ? 'verified' : ''}"><span class="status-icon">🎯</span><span class="status-label">PoI</span><span class="status-check">✓</span></div>\n`;
    response += `<div class="status-connector">=</div>\n`;
    response += `<div class="status-item final ${verified ? 'verified' : ''}"><span class="status-label">${s('verified')}</span></div>\n`;
    response += `</div>\n\n`;
    response += `<small style="color:#4e5563;display:block;margin-top:12px;text-align:center;">${s('disclaimer')}</small>\n\n`;
    response += `</div>`;
    return response;
}

// ═══════════════════════════════════════════════════════════════
// EMPLOYMENT SCREENING INTENT DETECTION (chat intercept — after credit)
// ═══════════════════════════════════════════════════════════════

function detectHiringRequest(message) {
    if (!message || typeof message !== 'string') return false;
    const lower = message.toLowerCase();
    const hiringKeywords = ['candidate assessment', 'hiring evaluation', 'employment screening',
        'candidate evaluation', 'job applicant', 'hiring assessment', 'candidate screening',
        'interview assessment', 'applicant evaluation', 'candidate review'];
    const hiringKeywordsAR = ['تقييم مرشح', 'فرز توظيف', 'تقييم توظيف', 'فحص مرشح',
        'تقييم موظف', 'مقابلة عمل', 'تقييم المتقدم', 'فحص التوظيف', 'مرشح للوظيفة'];
    const hasKeyword = hiringKeywords.some(k => lower.includes(k));
    const hasArabicHiring = hiringKeywordsAR.some(k => message.includes(k));
    const terms = ['candidate', 'experience', 'skill', 'interview', 'reference', 'hiring',
        'education', 'applicant', 'resume', 'qualification'];
    const termCount = terms.filter(t => lower.includes(t)).length;
    return hasKeyword || hasArabicHiring || termCount >= 3;
}

function extractHiringParams(message) {
    if (!message || typeof message !== 'string') return {};
    return {
        experience_years: extractNumber(message, /(?:experience[_\s]*(?:years|yrs)?|سنوات[_\s]*الخبرة|خبرة)[:\s=]*(\d+)/i),
        skill_match_score: extractFloat(message, /(?:skill[_\s]*(?:match)?[_\s]*(?:score)?|درجة[_\s]*المهارات|تطابق[_\s]*المهارات|مهارات)[:\s=]*([0-9]*\.?[0-9]+)/i),
        education_level: extractNumber(message, /(?:education[_\s]*(?:level)?|المستوى[_\s]*التعليمي|تعليم)[:\s=]*(\d)/i),
        interview_score: extractFloat(message, /(?:interview[_\s]*(?:score)?|درجة[_\s]*المقابلة|مقابلة)[:\s=]*([0-9]*\.?[0-9]+)/i),
        reference_score: extractFloat(message, /(?:reference[_\s]*(?:score)?|درجة[_\s]*المراجع|مراجع)[:\s=]*([0-9]*\.?[0-9]+)/i)
    };
}

function formatHiringResponse(result, lang) {
    lang = lang || 'en';
    const dir = lang === 'ar' ? ' dir="rtl"' : '';
    const s = (key) => t('shared', key, lang);
    const m = (key) => t('hiring', key, lang);
    const d = result.decision;
    const vb = result.verification_bundle;
    const recIcons = { RECOMMENDED: '🟢', NOT_RECOMMENDED: '🔴', FURTHER_REVIEW: '🟠' };
    const icon = recIcons[d.recommendation] || '⚪';
    const recLabel = d.recommendation === 'RECOMMENDED' ? m('recommended') : d.recommendation === 'NOT_RECOMMENDED' ? m('notRecommended') : m('furtherReview');
    const recSub = d.recommendation === 'RECOMMENDED' ? m('recommendedSub') : d.recommendation === 'NOT_RECOMMENDED' ? m('notRecommendedSub') : m('furtherReviewSub');

    let response = `<div${dir}>\n\n`;
    response += `## ${s('triadicTitle')} — ${m('systemTitle')}\n\n`;
    response += `<div class="triage-priority-badge priority-${d.recommendation}">\n<span class="priority-icon">${icon}</span>\n<span class="priority-label">${recLabel}</span>\n<span class="priority-sub">${recSub}</span>\n</div>\n\n`;
    response += `| ${s('parameter')} | ${s('value')} |\n|---|---|\n`;
    response += `| ${m('compositeScore')} | ${(d.composite_score != null ? (d.composite_score * 100).toFixed(1) : '—')}% |\n`;
    response += `| ${m('candidateTier')} | ${d.candidate_tier} |\n\n`;
    response += `### ${s('reasoningChain')}\n\n`;
    response += `| # | ${s('ruleHeader')} | ${s('resultHeader')} | ${s('inputHeader')} |\n|---|------|--------|-------|\n`;
    (d.allRules || []).forEach(r => {
        const trig = r.triggered ? '✅ ' + s('yes') : s('no');
        response += `| ${r.id} | ${r.rule} | ${trig} | ${r.detail || ''} |\n`;
    });
    response += `\n### ${s('reasonGraph')}\n\n`;
    const graph = vb.por.graph;
    const graphJson = JSON.stringify(graph).replace(/"/g, '&quot;');
    response += `<div class="triage-reason-graph" data-graph="${graphJson}"></div>\n\n`;
    response += `<details>\n<summary>🔐 ${s('pooTitle')}</summary>\n\n`;
    response += `- **${s('hash')}:** \`${vb.poo.hash}\`\n`;
    response += `- **${s('timestamp')}:** ${vb.poo.timestamp}\n`;
    response += `- **${s('signature')}:** \`${String(vb.poo.signature).substring(0, 32)}...\`\n\n</details>\n\n`;
    response += `<details>\n<summary>📐 ${s('porTitle')}</summary>\n\n`;
    const verts = (vb.por.graph.vertices || []);
    response += `- **${s('vertices')}:** ${verts.length} · **${s('edges')}:** ${(vb.por.graph.edges || []).length}\n`;
    response += `- **${s('graphHash')}:** \`${vb.por.hash}\`\n\n</details>\n\n`;
    response += `<details>\n<summary>🎯 ${s('poiTitle')}</summary>\n\n`;
    response += `- **${s('policy')}:** ${m('policyName')}\n`;
    (vb.poi.results || []).forEach(r => {
        response += `- ${r.constraint}: ${r.satisfied ? '✅' : '❌'} ${r.detail || ''}\n`;
    });
    response += `\n</details>\n\n`;
    const verified = vb.overall_result === 'VERIFIED';
    response += `<div class="verification-status-bar">\n`;
    response += `<div class="status-item ${verified ? 'verified' : ''}"><span class="status-icon">🔐</span><span class="status-label">PoO</span><span class="status-check">✓</span></div>\n`;
    response += `<div class="status-connector">→</div>\n`;
    response += `<div class="status-item ${verified ? 'verified' : ''}"><span class="status-icon">📐</span><span class="status-label">PoR</span><span class="status-check">✓</span></div>\n`;
    response += `<div class="status-connector">→</div>\n`;
    response += `<div class="status-item ${verified ? 'verified' : ''}"><span class="status-icon">🎯</span><span class="status-label">PoI</span><span class="status-check">✓</span></div>\n`;
    response += `<div class="status-connector">=</div>\n`;
    response += `<div class="status-item final ${verified ? 'verified' : ''}"><span class="status-label">${s('verified')}</span></div>\n`;
    response += `</div>\n\n`;
    response += `<small style="color:#4e5563;display:block;margin-top:12px;text-align:center;">${s('disclaimer')}</small>\n\n`;
    response += `</div>`;
    return response;
}

// ═══════════════════════════════════════════════════════════════
// BUILDING PERMIT INTENT DETECTION (chat intercept — after hiring)
// ═══════════════════════════════════════════════════════════════

function detectPermitRequest(message) {
    if (!message || typeof message !== 'string') return false;
    const lower = message.toLowerCase();
    const permitKeywords = ['building permit', 'permit assessment', 'permit evaluation',
        'construction permit', 'zoning assessment', 'building assessment', 'permit application',
        'building approval', 'construction assessment', 'permit review'];
    const permitKeywordsAR = ['تصريح بناء', 'تقييم تصريح', 'رخصة بناء', 'تقييم بناء',
        'امتثال تنظيمي', 'تصريح حكومي', 'رخصة إنشاء', 'تقييم إنشائي', 'فحص البناء'];
    const hasKeyword = permitKeywords.some(k => lower.includes(k));
    const hasArabicPermit = permitKeywordsAR.some(k => message.includes(k));
    const terms = ['permit', 'zoning', 'structural', 'safety', 'building', 'construction',
        'environmental', 'fire', 'coverage', 'plot', 'inspection'];
    const termCount = terms.filter(t => lower.includes(t)).length;
    return hasKeyword || hasArabicPermit || termCount >= 3;
}

function extractPermitParams(message) {
    if (!message || typeof message !== 'string') return {};
    return {
        zoning_compliance: extractFloat(message, /(?:zoning[_\s]*(?:compliance)?|امتثال[_\s]*التنظيم|تنظيم[_\s]*عمراني|تنظيم)[:\s=]*([0-9]*\.?[0-9]+)/i),
        structural_safety: extractFloat(message, /(?:structural[_\s]*(?:safety)?|السلامة[_\s]*الإنشائية|سلامة[_\s]*إنشائية|سلامة)[:\s=]*([0-9]*\.?[0-9]+)/i),
        environmental_impact: extractFloat(message, /(?:environmental[_\s]*(?:impact)?|الأثر[_\s]*البيئي|أثر[_\s]*بيئي|بيئي)[:\s=]*([0-9]*\.?[0-9]+)/i),
        plot_coverage_ratio: extractFloat(message, /(?:(?:plot[_\s]*)?coverage[_\s]*(?:ratio)?|نسبة[_\s]*التغطية|تغطية)[:\s=]*([0-9]*\.?[0-9]+)/i),
        fire_safety_score: extractFloat(message, /(?:fire[_\s]*(?:safety)?[_\s]*(?:score)?|السلامة[_\s]*من[_\s]*الحريق|حريق|سلامة[_\s]*حريق)[:\s=]*([0-9]*\.?[0-9]+)/i)
    };
}

function formatPermitResponse(result, lang) {
    lang = lang || 'en';
    const dir = lang === 'ar' ? ' dir="rtl"' : '';
    const s = (key) => t('shared', key, lang);
    const m = (key) => t('permit', key, lang);
    const d = result.decision;
    const vb = result.verification_bundle;
    const recIcons = { APPROVED: '🟢', DENIED: '🔴', CONDITIONAL_APPROVAL: '🟠' };
    const icon = recIcons[d.recommendation] || '⚪';
    const recLabel = d.recommendation === 'APPROVED' ? m('approved') : d.recommendation === 'DENIED' ? m('denied') : m('conditional');
    const recSub = d.recommendation === 'APPROVED' ? m('approvedSub') : d.recommendation === 'DENIED' ? m('deniedSub') : m('conditionalSub');

    let response = `<div${dir}>\n\n`;
    response += `## ${s('triadicTitle')} — ${m('systemTitle')}\n\n`;
    response += `<div class="triage-priority-badge priority-${d.recommendation}">\n<span class="priority-icon">${icon}</span>\n<span class="priority-label">${recLabel}</span>\n<span class="priority-sub">${recSub}</span>\n</div>\n\n`;
    response += `| ${s('parameter')} | ${s('value')} |\n|---|---|\n`;
    response += `| ${m('permitScore')} | ${(d.permit_score != null ? (d.permit_score * 100).toFixed(1) : '—')}% |\n`;
    response += `| ${m('permitClass')} | ${d.permit_class} |\n\n`;
    response += `### ${s('reasoningChain')}\n\n`;
    response += `| # | ${s('ruleHeader')} | ${s('resultHeader')} | ${s('inputHeader')} |\n|---|------|--------|-------|\n`;
    (d.allRules || []).forEach(r => {
        const trig = r.triggered ? '✅ ' + s('yes') : s('no');
        response += `| ${r.id} | ${r.rule} | ${trig} | ${r.detail || ''} |\n`;
    });
    response += `\n### ${s('reasonGraph')}\n\n`;
    const graph = vb.por.graph;
    const graphJson = JSON.stringify(graph).replace(/"/g, '&quot;');
    response += `<div class="triage-reason-graph" data-graph="${graphJson}"></div>\n\n`;
    response += `<details>\n<summary>🔐 ${s('pooTitle')}</summary>\n\n`;
    response += `- **${s('hash')}:** \`${vb.poo.hash}\`\n`;
    response += `- **${s('timestamp')}:** ${vb.poo.timestamp}\n`;
    response += `- **${s('signature')}:** \`${String(vb.poo.signature).substring(0, 32)}...\`\n\n</details>\n\n`;
    response += `<details>\n<summary>📐 ${s('porTitle')}</summary>\n\n`;
    const verts = (vb.por.graph.vertices || []);
    response += `- **${s('vertices')}:** ${verts.length} · **${s('edges')}:** ${(vb.por.graph.edges || []).length}\n`;
    response += `- **${s('graphHash')}:** \`${vb.por.hash}\`\n\n</details>\n\n`;
    response += `<details>\n<summary>🎯 ${s('poiTitle')}</summary>\n\n`;
    response += `- **${s('policy')}:** ${m('policyName')}\n`;
    (vb.poi.results || []).forEach(r => {
        response += `- ${r.constraint}: ${r.satisfied ? '✅' : '❌'} ${r.detail || ''}\n`;
    });
    response += `\n</details>\n\n`;
    const verified = vb.overall_result === 'VERIFIED';
    response += `<div class="verification-status-bar">\n`;
    response += `<div class="status-item ${verified ? 'verified' : ''}"><span class="status-icon">🔐</span><span class="status-label">PoO</span><span class="status-check">✓</span></div>\n`;
    response += `<div class="status-connector">→</div>\n`;
    response += `<div class="status-item ${verified ? 'verified' : ''}"><span class="status-icon">📐</span><span class="status-label">PoR</span><span class="status-check">✓</span></div>\n`;
    response += `<div class="status-connector">→</div>\n`;
    response += `<div class="status-item ${verified ? 'verified' : ''}"><span class="status-icon">🎯</span><span class="status-label">PoI</span><span class="status-check">✓</span></div>\n`;
    response += `<div class="status-connector">=</div>\n`;
    response += `<div class="status-item final ${verified ? 'verified' : ''}"><span class="status-label">${s('verified')}</span></div>\n`;
    response += `</div>\n\n`;
    response += `<small style="color:#4e5563;display:block;margin-top:12px;text-align:center;">${s('disclaimer')}</small>\n\n`;
    response += `</div>`;
    return response;
}

// Main AI chat endpoint with streaming
app.post('/api/ai/stream', optionalAuth, async (req, res) => {
    try {
        if (process.env.TRIAGE_DEBUG) {
            console.log('[TRIAGE] === New request ===', 'URL:', req.url, 'Body keys:', Object.keys(req.body || {}));
        }

        const conversation_id = req.body.conversation_id || req.body.conversationId;
        const mode = req.body.mode || 'deep';

        // Extract message text — handle all possible frontend formats (MUST run before mode/usage)
        let rawMessage = '';
        if (typeof req.body === 'string') {
            rawMessage = req.body;
        } else if (req.body) {
            const b = req.body;
            if (typeof b.message === 'string') rawMessage = b.message;
            else if (typeof b.text === 'string') rawMessage = b.text;
            else if (typeof b.content === 'string') rawMessage = b.content;
            else if (typeof b.prompt === 'string') rawMessage = b.prompt;
            else if (Array.isArray(b.messages) && b.messages.length > 0) {
                const last = b.messages[b.messages.length - 1];
                rawMessage = typeof last.content === 'string' ? last.content : (last.text || '');
            }
        }

        if (!rawMessage || !rawMessage.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // ═══════════════════════════════════════════════════════════════
        // TRIAGE INTERCEPT — FIRST (works in ALL modes; bypasses AI)
        // ═══════════════════════════════════════════════════════════════
        if (detectTriageRequest(rawMessage)) {
            const params = extractPatientParams(rawMessage);
            const requiredParams = ['vital_score', 'age', 'comorbidity_index', 'wait_time', 'resource_score'];
            const missingParams = requiredParams.filter(p => params[p] === undefined || Number.isNaN(Number(params[p])));

            if (process.env.TRIAGE_DEBUG) {
                console.log('[TRIAGE] Params:', JSON.stringify(params), 'Missing:', missingParams);
            }

            if (missingParams.length === 0) {
                const patientData = {
                    vital_score: Number(params.vital_score),
                    age: Number(params.age),
                    comorbidity_index: Number(params.comorbidity_index),
                    wait_time: Number(params.wait_time),
                    resource_score: Number(params.resource_score)
                };
                const valid = [patientData.vital_score, patientData.age, patientData.comorbidity_index, patientData.wait_time, patientData.resource_score].every(v => Number.isFinite(v));
                if (valid) {
                    const usageCheck = await checkUsageLimit(req.user, req);
                    if (!usageCheck.allowed) {
                        return res.status(429).json({ error: usageCheck.message, upgrade_url: '/login' });
                    }
                    const result = triageDecision(patientData);
                    const formattedResponse = formatTriageResponse(result, detectLanguage(rawMessage));
                    if (process.env.TRIAGE_DEBUG) console.log('[TRIAGE] Engine result Priority:', result.decision.priority);
                    res.setHeader('Content-Type', 'text/event-stream');
                    res.setHeader('Cache-Control', 'no-cache');
                    res.setHeader('Connection', 'keep-alive');
                    res.write(`data: ${JSON.stringify({ text: formattedResponse })}\n\n`);
                    const remaining = usageCheck.remaining !== undefined ? usageCheck.remaining - 1 : (req.user ? 49 : GUEST_LIMIT - 1);
                    res.write(`data: ${JSON.stringify({ done: true, remaining })}\n\n`);
                    res.end();
                    const message = rawMessage;
                    if (req.user && conversation_id) {
                        await pool.query(
                            `INSERT INTO messages (conversation_id, role, content, mode) VALUES ($1, 'user', $2, $3)`,
                            [conversation_id, message, mode]
                        );
                        await pool.query(
                            `INSERT INTO messages (conversation_id, role, content, mode, model) VALUES ($1, 'assistant', $2, $3, 'triage-engine')`,
                            [conversation_id, formattedResponse, mode]
                        );
                        await pool.query(
                            `UPDATE conversations SET message_count = message_count + 2, last_message_at = NOW(), title = CASE WHEN message_count = 0 THEN $2 ELSE title END WHERE id = $1`,
                            [conversation_id, message.substring(0, 50)]
                        );
                        await pool.query('UPDATE users SET messages_today = messages_today + 1 WHERE id = $1', [req.user.id]);
                    } else {
                        const entry = getGuestUsage(req);
                        entry.count += 1;
                    }
                    return;
                }
            } else if (missingParams.length <= 2) {
                const usageCheck = await checkUsageLimit(req.user, req);
                if (!usageCheck.allowed) {
                    return res.status(429).json({ error: usageCheck.message, upgrade_url: '/login' });
                }
                const askMessage = `To perform OpLogica Triadic Verification triage, I need these additional parameters:\n${missingParams.map(p => `• ${p}`).join('\n')}\n\nPlease provide them to run the full verified assessment.`;
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                res.write(`data: ${JSON.stringify({ text: askMessage })}\n\n`);
                const remaining = usageCheck.remaining !== undefined ? usageCheck.remaining - 1 : (req.user ? 49 : GUEST_LIMIT - 1);
                res.write(`data: ${JSON.stringify({ done: true, remaining })}\n\n`);
                res.end();
                const message = rawMessage;
                if (req.user && conversation_id) {
                    await pool.query(
                        `INSERT INTO messages (conversation_id, role, content, mode) VALUES ($1, 'user', $2, $3)`,
                        [conversation_id, message, mode]
                    );
                    await pool.query(
                        `INSERT INTO messages (conversation_id, role, content, mode, model) VALUES ($1, 'assistant', $2, $3, 'triage-engine')`,
                        [conversation_id, askMessage, mode]
                    );
                    await pool.query(
                        `UPDATE conversations SET message_count = message_count + 2, last_message_at = NOW(), title = CASE WHEN message_count = 0 THEN $2 ELSE title END WHERE id = $1`,
                        [conversation_id, message.substring(0, 50)]
                    );
                    await pool.query('UPDATE users SET messages_today = messages_today + 1 WHERE id = $1', [req.user.id]);
                } else {
                    const entry = getGuestUsage(req);
                    entry.count += 1;
                }
                return;
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // CREDIT ASSESSMENT INTERCEPT — after triage (all modes)
        // ═══════════════════════════════════════════════════════════════
        if (detectCreditRequest(rawMessage)) {
            const params = extractCreditParams(rawMessage);
            if (params.credit_score != null && params.annual_income != null && params.debt_to_income != null && params.loan_amount != null) {
                const usageCheck = await checkUsageLimit(req.user, req);
                if (!usageCheck.allowed) {
                    return res.status(429).json({ error: usageCheck.message, upgrade_url: '/login' });
                }
                const creditParams = {
                    credit_score: Number(params.credit_score),
                    annual_income: Number(params.annual_income),
                    debt_to_income: Number(params.debt_to_income),
                    loan_amount: Number(params.loan_amount),
                    employment_years: params.employment_years != null ? Number(params.employment_years) : 0
                };
                const valid = [creditParams.credit_score, creditParams.annual_income, creditParams.debt_to_income, creditParams.loan_amount].every(v => Number.isFinite(v));
                if (valid) {
                    const result = creditEngine.evaluateCredit(creditParams);
                    const formattedResponse = formatCreditResponse(result, detectLanguage(rawMessage));
                    res.setHeader('Content-Type', 'text/event-stream');
                    res.setHeader('Cache-Control', 'no-cache');
                    res.setHeader('Connection', 'keep-alive');
                    res.write(`data: ${JSON.stringify({ text: formattedResponse })}\n\n`);
                    const remaining = usageCheck.remaining !== undefined ? usageCheck.remaining - 1 : (req.user ? 49 : GUEST_LIMIT - 1);
                    res.write(`data: ${JSON.stringify({ done: true, remaining })}\n\n`);
                    res.end();
                    if (req.user && conversation_id) {
                        await pool.query(
                            `INSERT INTO messages (conversation_id, role, content, mode) VALUES ($1, 'user', $2, $3)`,
                            [conversation_id, rawMessage, mode]
                        );
                        await pool.query(
                            `INSERT INTO messages (conversation_id, role, content, mode, model) VALUES ($1, 'assistant', $2, $3, 'credit-engine')`,
                            [conversation_id, formattedResponse, mode]
                        );
                        await pool.query(
                            `UPDATE conversations SET message_count = message_count + 2, last_message_at = NOW(), title = CASE WHEN message_count = 0 THEN $2 ELSE title END WHERE id = $1`,
                            [conversation_id, rawMessage.substring(0, 50)]
                        );
                        await pool.query('UPDATE users SET messages_today = messages_today + 1 WHERE id = $1', [req.user.id]);
                    } else {
                        const entry = getGuestUsage(req);
                        entry.count += 1;
                    }
                    return;
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // EMPLOYMENT SCREENING INTERCEPT — after credit (all modes)
        // ═══════════════════════════════════════════════════════════════
        if (detectHiringRequest(rawMessage)) {
            const params = extractHiringParams(rawMessage);
            if (params.experience_years != null && params.skill_match_score != null && params.interview_score != null) {
                const usageCheck = await checkUsageLimit(req.user, req);
                if (!usageCheck.allowed) {
                    return res.status(429).json({ error: usageCheck.message, upgrade_url: '/login' });
                }
                const hiringParams = {
                    experience_years: Number(params.experience_years),
                    skill_match_score: Number(params.skill_match_score),
                    interview_score: Number(params.interview_score),
                    education_level: params.education_level != null ? Number(params.education_level) : 3,
                    reference_score: params.reference_score != null ? Number(params.reference_score) : 0.75
                };
                const valid = [hiringParams.experience_years, hiringParams.skill_match_score, hiringParams.interview_score].every(v => Number.isFinite(v));
                if (valid) {
                    const result = hiringEngine.evaluateCandidate(hiringParams);
                    const formattedResponse = formatHiringResponse(result, detectLanguage(rawMessage));
                    res.setHeader('Content-Type', 'text/event-stream');
                    res.setHeader('Cache-Control', 'no-cache');
                    res.setHeader('Connection', 'keep-alive');
                    res.write(`data: ${JSON.stringify({ text: formattedResponse })}\n\n`);
                    const remaining = usageCheck.remaining !== undefined ? usageCheck.remaining - 1 : (req.user ? 49 : GUEST_LIMIT - 1);
                    res.write(`data: ${JSON.stringify({ done: true, remaining })}\n\n`);
                    res.end();
                    if (req.user && conversation_id) {
                        await pool.query(
                            `INSERT INTO messages (conversation_id, role, content, mode) VALUES ($1, 'user', $2, $3)`,
                            [conversation_id, rawMessage, mode]
                        );
                        await pool.query(
                            `INSERT INTO messages (conversation_id, role, content, mode, model) VALUES ($1, 'assistant', $2, $3, 'hiring-engine')`,
                            [conversation_id, formattedResponse, mode]
                        );
                        await pool.query(
                            `UPDATE conversations SET message_count = message_count + 2, last_message_at = NOW(), title = CASE WHEN message_count = 0 THEN $2 ELSE title END WHERE id = $1`,
                            [conversation_id, rawMessage.substring(0, 50)]
                        );
                        await pool.query('UPDATE users SET messages_today = messages_today + 1 WHERE id = $1', [req.user.id]);
                    } else {
                        const entry = getGuestUsage(req);
                        entry.count += 1;
                    }
                    return;
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // BUILDING PERMIT INTERCEPT — after hiring (all modes)
        // ═══════════════════════════════════════════════════════════════
        if (detectPermitRequest(rawMessage)) {
            const params = extractPermitParams(rawMessage);
            if (params.zoning_compliance != null && params.structural_safety != null) {
                const usageCheck = await checkUsageLimit(req.user, req);
                if (!usageCheck.allowed) {
                    return res.status(429).json({ error: usageCheck.message, upgrade_url: '/login' });
                }
                const permitParams = {
                    zoning_compliance: Number(params.zoning_compliance),
                    structural_safety: Number(params.structural_safety),
                    environmental_impact: params.environmental_impact != null ? Number(params.environmental_impact) : 0.30,
                    plot_coverage_ratio: params.plot_coverage_ratio != null ? Number(params.plot_coverage_ratio) : 0.50,
                    fire_safety_score: params.fire_safety_score != null ? Number(params.fire_safety_score) : 0.75
                };
                const valid = [permitParams.zoning_compliance, permitParams.structural_safety].every(v => Number.isFinite(v));
                if (valid) {
                    const result = permitEngine.evaluatePermit(permitParams);
                    const formattedResponse = formatPermitResponse(result, detectLanguage(rawMessage));
                    res.setHeader('Content-Type', 'text/event-stream');
                    res.setHeader('Cache-Control', 'no-cache');
                    res.setHeader('Connection', 'keep-alive');
                    res.write(`data: ${JSON.stringify({ text: formattedResponse })}\n\n`);
                    const remaining = usageCheck.remaining !== undefined ? usageCheck.remaining - 1 : (req.user ? 49 : GUEST_LIMIT - 1);
                    res.write(`data: ${JSON.stringify({ done: true, remaining })}\n\n`);
                    res.end();
                    if (req.user && conversation_id) {
                        await pool.query(
                            `INSERT INTO messages (conversation_id, role, content, mode) VALUES ($1, 'user', $2, $3)`,
                            [conversation_id, rawMessage, mode]
                        );
                        await pool.query(
                            `INSERT INTO messages (conversation_id, role, content, mode, model) VALUES ($1, 'assistant', $2, $3, 'permit-engine')`,
                            [conversation_id, formattedResponse, mode]
                        );
                        await pool.query(
                            `UPDATE conversations SET message_count = message_count + 2, last_message_at = NOW(), title = CASE WHEN message_count = 0 THEN $2 ELSE title END WHERE id = $1`,
                            [conversation_id, rawMessage.substring(0, 50)]
                        );
                        await pool.query('UPDATE users SET messages_today = messages_today + 1 WHERE id = $1', [req.user.id]);
                    } else {
                        const entry = getGuestUsage(req);
                        entry.count += 1;
                    }
                    return;
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // END TRIAGE / CREDIT / HIRING / PERMIT INTERCEPTS — fall through to AI
        // ═══════════════════════════════════════════════════════════════

        const message = rawMessage;
        const usageCheck = await checkUsageLimit(req.user, req);
        if (!usageCheck.allowed) {
            return res.status(429).json({
                error: usageCheck.message,
                upgrade_url: '/login'
            });
        }

        const limits = req.user ? PLAN_LIMITS.free : PLAN_LIMITS.guest;
        if (!limits.modes.includes(mode)) {
            return res.status(403).json({
                error: `وضع "${mode}" متاح للمستخدمين المسجلين فقط.`,
                upgrade_url: '/login'
            });
        }

        let conversationHistory = [];
        if (conversation_id && req.user) {
            const historyResult = await pool.query(
                `SELECT role, content FROM messages 
                 WHERE conversation_id = $1 
                 ORDER BY created_at ASC
                 LIMIT 20`,
                [conversation_id]
            );
            conversationHistory = historyResult.rows.map(m => ({
                role: m.role,
                content: m.content
            }));
        }
        
        // Optional image: base64 data URL or raw base64
        let userContent = message;
        const imagePayload = req.body.image;
        if (imagePayload && typeof imagePayload === 'string') {
            let base64 = imagePayload;
            let mediaType = 'image/jpeg';
            const dataUrlMatch = imagePayload.match(/^data:([^;]+);base64,(.+)$/);
            if (dataUrlMatch) {
                mediaType = dataUrlMatch[1].trim();
                base64 = dataUrlMatch[2];
            }
            if (base64.length > 0 && /^image\//.test(mediaType)) {
                userContent = [
                    { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
                    { type: 'text', text: message }
                ];
            }
        }

        // Build messages array
        const messages = [
            ...conversationHistory,
            { role: 'user', content: userContent }
        ];
        
        // Set up SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        let fullResponse = '';
        
        // Stream from Claude
        const stream = await anthropic.messages.stream({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            messages: messages
        });
        
        for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.text) {
                fullResponse += event.delta.text;
                res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
            }
        }
        
        if (req.user && conversation_id) {
            await pool.query(
                `INSERT INTO messages (conversation_id, role, content, mode)
                 VALUES ($1, 'user', $2, $3)`,
                [conversation_id, message, mode]
            );
            await pool.query(
                `INSERT INTO messages (conversation_id, role, content, mode, model)
                 VALUES ($1, 'assistant', $2, $3, 'claude-sonnet-4')`,
                [conversation_id, fullResponse, mode]
            );
            await pool.query(
                `UPDATE conversations 
                 SET message_count = message_count + 2, 
                     last_message_at = NOW(),
                     title = CASE WHEN message_count = 0 THEN $2 ELSE title END
                 WHERE id = $1`,
                [conversation_id, message.substring(0, 50)]
            );
            await pool.query(
                'UPDATE users SET messages_today = messages_today + 1 WHERE id = $1',
                [req.user.id]
            );
        } else {
            const entry = getGuestUsage(req);
            entry.count += 1;
        }
        
        const remaining = usageCheck.remaining !== undefined ? usageCheck.remaining - 1 : (req.user ? 49 : GUEST_LIMIT - 1);
        res.write(`data: ${JSON.stringify({ done: true, remaining })}\n\n`);
        res.end();
        
    } catch (error) {
        console.error('AI stream error:', error);
        res.write(`data: ${JSON.stringify({ error: 'AI service error' })}\n\n`);
        res.end();
    }
});

// ═══════════════════════════════════════════════════════════════
// HEALTH & STATIC ROUTES
// ═══════════════════════════════════════════════════════════════

// Health check
app.get('/api/health', async (req, res) => {
    try {
        // Test database connection
        await pool.query('SELECT 1');
        
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: '2.0.0',
            database: 'connected'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            database: 'disconnected'
        });
    }
});

// Serve chat page
app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/chat.html'));
});

// Serve Decision Control Room (flagship interface)
app.get('/control', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/control-room.html'));
});

// Reason Graph Visualizer (standalone)
app.get('/reason-graph', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/reason-graph.html'));
});

// Decision Ledger
app.get('/decision-ledger', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/decision-ledger.html'));
});

// Decision Ledger API proxy (read-only; keeps API key server-side)
const LEDGER_API_BASE = process.env.LEDGER_API_BASE || 'https://api.oplogica.ai/v1';
const LEDGER_API_KEY = process.env.LEDGER_API_KEY || '';

async function ledgerProxy(path, query = '') {
    const url = LEDGER_API_BASE + path + (query ? '?' + query : '');
    const res = await fetch(url, {
        headers: { 'Authorization': LEDGER_API_KEY ? `Bearer ${LEDGER_API_KEY}` : '' }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, error: data.error || { message: 'Request failed' } };
    return { ok: true, data };
}

app.get('/api/ledger/decisions', async (req, res) => {
    try {
        const q = new URLSearchParams(req.query).toString();
        const out = await ledgerProxy('/decisions', q);
        if (!out.ok) return res.status(out.status || 502).json(out.error || { error: { code: 'PROXY_ERROR', message: 'Upstream error' } });
        return res.json(out.data);
    } catch (e) {
        console.error('Ledger proxy /decisions:', e);
        return res.status(502).json({ error: { code: 'PROXY_ERROR', message: 'Service unavailable' } });
    }
});

app.get('/api/ledger/decisions/:id', async (req, res) => {
    try {
        const out = await ledgerProxy('/decisions/' + encodeURIComponent(req.params.id));
        if (!out.ok) return res.status(out.status || 502).json(out.error || { error: { code: 'PROXY_ERROR', message: 'Upstream error' } });
        return res.json(out.data);
    } catch (e) {
        console.error('Ledger proxy /decisions/:id:', e);
        return res.status(502).json({ error: { code: 'PROXY_ERROR', message: 'Service unavailable' } });
    }
});

app.get('/api/ledger/decisions/:id/reason-graph', async (req, res) => {
    try {
        const out = await ledgerProxy('/decisions/' + encodeURIComponent(req.params.id) + '/reason-graph');
        if (!out.ok) return res.status(out.status || 502).json(out.error || { error: { code: 'PROXY_ERROR', message: 'Upstream error' } });
        return res.json(out.data);
    } catch (e) {
        console.error('Ledger proxy /decisions/:id/reason-graph:', e);
        return res.status(502).json({ error: { code: 'PROXY_ERROR', message: 'Service unavailable' } });
    }
});

app.get('/api/ledger/audit/readiness', async (req, res) => {
    try {
        const out = await ledgerProxy('/audit/readiness');
        if (!out.ok) return res.status(out.status || 502).json(out.error || { error: { code: 'PROXY_ERROR', message: 'Upstream error' } });
        return res.json(out.data);
    } catch (e) {
        console.error('Ledger proxy /audit/readiness:', e);
        return res.status(502).json({ error: { code: 'PROXY_ERROR', message: 'Service unavailable' } });
    }
});

// Medical Triage Demo (triadic verification — same triageDecision used by chat)
app.get('/demo', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/demo.html'));
});

app.post('/api/triage-demo', (req, res) => {
    try {
        const body = req.body || {};
        const patientData = {
            vital_score: Number(body.vital_score),
            age: Number(body.age),
            comorbidity_index: Number(body.comorbidity_index),
            wait_time: Number(body.wait_time),
            resource_score: Number(body.resource_score)
        };
        if ([patientData.vital_score, patientData.age, patientData.comorbidity_index, patientData.wait_time, patientData.resource_score].some(v => Number.isNaN(v))) {
            return res.status(400).json({ error: 'Invalid patient data: vital_score, age, comorbidity_index, wait_time, resource_score must be numbers' });
        }
        const result = triageDecision(patientData);
        return res.json(result);
    } catch (err) {
        console.error('Triage demo error:', err);
        return res.status(500).json({ error: 'Triage engine error', message: err.message });
    }
});

// Financial Credit Assessment Demo
app.get('/demo/finance', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/demo-finance.html'));
});

app.post('/api/credit-demo', express.json(), (req, res) => {
    try {
        const result = creditEngine.evaluateCredit(req.body || {});
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Employment Screening Demo
app.get('/demo/hiring', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/demo-hiring.html'));
});

app.post('/api/hiring-demo', express.json(), (req, res) => {
    try {
        const result = hiringEngine.evaluateCandidate(req.body || {});
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Building Permit Assessment Demo
app.get('/demo/permits', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/demo-permits.html'));
});

app.post('/api/permit-demo', express.json(), (req, res) => {
    try {
        const result = permitEngine.evaluatePermit(req.body || {});
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Serve login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/login.html'));
});

// Verify Email
app.get("/api/auth/verify", async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) {
            return res.redirect("/verify.html?status=error&error=Token missing");
        }
        const result = await pool.query(
            "UPDATE users SET email_verified = TRUE, verification_token = NULL WHERE verification_token = $1 RETURNING id, email, full_name",
            [token]
        );
        if (result.rows.length === 0) {
            return res.redirect("/verify.html?status=error&error=Invalid or expired token");
        }
        const user = result.rows[0];
        sendWelcomeEmail(user.email, user.full_name).catch(err => console.error("Email error:", err));
        res.redirect("/verify.html?status=success");
    } catch (error) {
        console.error("Verify error:", error);
        res.redirect("/verify.html?status=error&error=Verification failed");
    }
});

// Serve landing page
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ═══════════════════════════════════════════════════════════════
// WEBSOCKET (Ledger real-time — WebSocket Spec v1)
// ═══════════════════════════════════════════════════════════════

const server = http.createServer(app);

const wss = new WebSocket.Server({ server, path: '/ws' });
const HEARTBEAT_INTERVAL_MS = 25000;

function broadcastLedger(message) {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}

wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
            }
        } catch (e) {
            // ignore non-JSON
        }
    });
});

const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, HEARTBEAT_INTERVAL_MS);

wss.on('close', () => clearInterval(heartbeatInterval));

// Expose for external use. Example: req.app.locals.broadcastLedger({ type: 'decision_created', payload: decision });
// Supported types: decision_created | decision_updated | audit_status_changed (payload optional).
app.locals.broadcastLedger = broadcastLedger;

// ═══════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════

server.listen(PORT, () => {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('   OpLogica Server v2.0 - AI Decision Intelligence');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   🚀 Server running on port ${PORT}`);
    console.log(`   📦 Database: PostgreSQL | Guest: ${GUEST_LIMIT} msgs | Registered: 50 msgs/day`);
    console.log(`   🔌 WebSocket: /ws (ledger real-time)`);
    console.log('═══════════════════════════════════════════════════════════');
});
