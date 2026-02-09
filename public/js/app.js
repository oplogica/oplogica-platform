// ============================================
// OpLogica - Main Application JavaScript
// ============================================

// State Management
const state = {
    user: null,
    session: null,
    currentView: 'overview',
    analysisType: 'decision',
    selectedModel: 'claude'
};

// API Base URL
const API_URL = '';

// ============================================
// Page Navigation
// ============================================

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

// ============================================
// User Type Selection
// ============================================

function selectUserType(type) {
    // Remove selected from all cards
    document.querySelectorAll('.user-type-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Add selected to clicked card
    document.querySelector(`[data-type="${type}"]`).classList.add('selected');
    
    // Update hidden input
    document.getElementById('user-type').value = type;
    
    // Update badge text
    const typeNames = {
        'individual': 'Individual',
        'researcher': 'Researcher',
        'business': 'Business',
        'institution': 'Institution'
    };
    document.getElementById('selected-type-text').textContent = typeNames[type];
    
    // Show registration form
    document.getElementById('user-type-selection').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
}

function resetUserType() {
    document.getElementById('user-type-selection').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.querySelectorAll('.user-type-card').forEach(card => {
        card.classList.remove('selected');
    });
}

// ============================================
// Authentication
// ============================================

// Login Form Handler
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    showLoading();
    
    try {
        const response = await fetch(`${API_URL}/api/auth/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            state.user = data.user;
            state.session = data.session;
            localStorage.setItem('session', JSON.stringify(data.session));
            showToast('Welcome back!', 'success');
            updateUserUI();
            showPage('dashboard-page');
            initDashboard();
        } else {
            showToast(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        showToast('Connection error. Please try again.', 'error');
    }
    
    hideLoading();
});

// Register Form Handler
document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fullName = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const userType = document.getElementById('user-type').value;
    
    if (!userType) {
        showToast('Please select a user type', 'error');
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch(`${API_URL}/api/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, fullName, userType })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Account created! Please check your email to verify.', 'success');
            showPage('login-page');
        } else {
            showToast(data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        showToast('Connection error. Please try again.', 'error');
    }
    
    hideLoading();
});

// Logout
function logout() {
    state.user = null;
    state.session = null;
    localStorage.removeItem('session');
    showToast('Logged out successfully', 'info');
    showPage('landing-page');
}

// Check Session on Load
async function checkSession() {
    const session = localStorage.getItem('session');
    if (session) {
        state.session = JSON.parse(session);
        try {
            const response = await fetch(`${API_URL}/api/user/profile`, {
                headers: {
                    'Authorization': `Bearer ${state.session.access_token}`
                }
            });
            const data = await response.json();
            if (data.success) {
                state.user = data.profile;
                updateUserUI();
                showPage('dashboard-page');
                initDashboard();
                return;
            }
        } catch (error) {
            console.log('Session expired');
        }
        localStorage.removeItem('session');
    }
}

// Update User UI
function updateUserUI() {
    if (state.user) {
        const initials = state.user.full_name?.split(' ').map(n => n[0]).join('') || 'U';
        document.getElementById('user-avatar').textContent = initials;
        document.getElementById('user-name').textContent = state.user.full_name || 'User';
        document.getElementById('user-type-label').textContent = state.user.user_type || 'Individual';
        
        if (document.getElementById('settings-name')) {
            document.getElementById('settings-name').value = state.user.full_name || '';
        }
        if (document.getElementById('settings-email')) {
            document.getElementById('settings-email').value = state.user.email || '';
        }
    }
}

// ============================================
// Dashboard Navigation
// ============================================

function switchView(viewName) {
    state.currentView = viewName;
    
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.view === viewName) {
            item.classList.add('active');
        }
    });
    
    // Update views
    document.querySelectorAll('.dashboard-view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(`${viewName}-view`).classList.add('active');
    
    // Update header
    const titles = {
        'overview': { title: 'Overview', subtitle: 'Welcome back! Here\'s your decision intelligence summary.' },
        'analyze': { title: 'Analyze', subtitle: 'Enter your decision or question for AI analysis.' },
        'history': { title: 'History', subtitle: 'Review your past decisions and analyses.' },
        'settings': { title: 'Settings', subtitle: 'Manage your account and preferences.' }
    };
    
    document.getElementById('page-title').textContent = titles[viewName].title;
    document.getElementById('page-subtitle').textContent = titles[viewName].subtitle;
}

// Initialize Dashboard Navigation
function initDashboardNav() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(item.dataset.view);
        });
    });
}

// ============================================
// Analysis
// ============================================

// Analysis Type Selection
document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.analysisType = btn.dataset.type;
    });
});

// Model Selection
document.querySelectorAll('input[name="model"]').forEach(input => {
    input.addEventListener('change', () => {
        state.selectedModel = input.value;
    });
});

// Run Analysis
async function runAnalysis() {
    const input = document.getElementById('analysis-input').value.trim();
    
    if (!input) {
        showToast('Please enter a decision or question to analyze', 'error');
        return;
    }
    
    showLoading();
    
    try {
        let endpoint = '/api/ai/analyze';
        if (state.selectedModel === 'claude') {
            endpoint = '/api/ai/claude';
        } else if (state.selectedModel === 'gpt') {
            endpoint = '/api/ai/gpt';
        }
        
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.session?.access_token || ''}`
            },
            body: JSON.stringify({
                prompt: input,
                analysisType: state.analysisType
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayAnalysisResult(data);
            showToast('Analysis complete!', 'success');
        } else {
            showToast(data.error || 'Analysis failed', 'error');
        }
    } catch (error) {
        showToast('Connection error. Please try again.', 'error');
        console.error(error);
    }
    
    hideLoading();
}

// Display Analysis Result
function displayAnalysisResult(data) {
    const outputCard = document.getElementById('analysis-output');
    
    // Extract trust score from response (if present)
    let trustScore = 85;
    const scoreMatch = data.response?.match(/Trust Score[:\s]*(\d+)/i) || 
                       data.claude?.response?.match(/Trust Score[:\s]*(\d+)/i) ||
                       data.gpt?.response?.match(/Trust Score[:\s]*(\d+)/i);
    if (scoreMatch) {
        trustScore = parseInt(scoreMatch[1]);
    }
    
    let html = '<div class="analysis-result">';
    
    if (data.claude && data.gpt) {
        // Both models
        html += `
            <div class="result-header">
                <div class="result-model">
                    <span class="result-model-badge claude">Claude</span>
                    <span class="result-model-badge gpt">GPT-4</span>
                </div>
                <div class="result-trust-score">
                    <span>Trust Score:</span>
                    <strong>${trustScore}</strong>
                </div>
            </div>
            <div class="result-content">
                <h4>Claude Analysis:</h4>
                ${formatResponse(data.claude.response)}
                
                <h4 style="margin-top: 32px;">GPT-4 Analysis:</h4>
                ${formatResponse(data.gpt.response)}
            </div>
        `;
    } else {
        // Single model
        const model = data.model || 'claude';
        html += `
            <div class="result-header">
                <div class="result-model">
                    <span class="result-model-badge ${model}">${model === 'claude' ? 'Claude' : 'GPT-4'}</span>
                </div>
                <div class="result-trust-score">
                    <span>Trust Score:</span>
                    <strong>${trustScore}</strong>
                </div>
            </div>
            <div class="result-content">
                ${formatResponse(data.response)}
            </div>
        `;
    }
    
    html += '</div>';
    outputCard.innerHTML = html;
}

// Format Response
function formatResponse(text) {
    if (!text) return '';
    
    // Convert markdown-like headers
    text = text.replace(/^### (.*$)/gim, '<h4>$1</h4>');
    text = text.replace(/^## (.*$)/gim, '<h3>$1</h3>');
    text = text.replace(/^# (.*$)/gim, '<h2>$1</h2>');
    
    // Convert bold
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert line breaks
    text = text.replace(/\n/g, '<br>');
    
    return text;
}

// ============================================
// Dashboard Initialization
// ============================================

function initDashboard() {
    initDashboardNav();
    loadVerificationList();
    loadHistory();
    initChart();
}

// Load Verification List
function loadVerificationList() {
    const list = document.getElementById('verification-list');
    if (!list) return;
    
    const items = [
        { date: '01-23-2011 - 10:49 - AM', status: 'verified' },
        { date: '01-23-2011 - 10:39 - PM', status: 'verified' },
        { date: '01-24-2011 - 10:40 - PM', status: 'verified' },
        { date: '01-26-2011 - 10:30 - PM', status: 'verified' },
        { date: '01-22-2011 - 10:30 - PM', status: 'verified' }
    ];
    
    list.innerHTML = items.map(item => `
        <div class="verification-item">
            <span class="date">${item.date}</span>
            <button class="verify-btn">Verified</button>
        </div>
    `).join('');
}

// Load History
async function loadHistory() {
    const list = document.getElementById('history-list');
    if (!list) return;
    
    // Demo data for now
    const decisions = [
        {
            title: 'Investment Strategy Analysis',
            content: 'Should I invest in renewable energy stocks given current market conditions?',
            type: 'decision',
            score: 87,
            date: '2025-01-15'
        },
        {
            title: 'Research Methodology Review',
            content: 'Evaluating the validity of our research approach for the climate study.',
            type: 'research',
            score: 92,
            date: '2025-01-14'
        },
        {
            title: 'Market Expansion Decision',
            content: 'Analysis of entering the Southeast Asian market in Q2.',
            type: 'business',
            score: 78,
            date: '2025-01-13'
        }
    ];
    
    list.innerHTML = decisions.map(d => `
        <div class="history-item">
            <div class="history-item-header">
                <h4>${d.title}</h4>
                <span class="date">${d.date}</span>
            </div>
            <p>${d.content}</p>
            <div class="history-item-footer">
                <span class="history-badge">${d.type}</span>
                <span class="history-score">Score: ${d.score}</span>
            </div>
        </div>
    `).join('');
}

// Initialize Chart (placeholder)
function initChart() {
    const canvas = document.getElementById('activity-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Simple line chart
    const data = [30, 45, 35, 50, 40, 60, 55, 70, 65, 80, 75, 90, 100];
    const width = canvas.width = canvas.parentElement.offsetWidth;
    const height = canvas.height = 200;
    
    ctx.clearRect(0, 0, width, height);
    
    // Draw gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(0, 217, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 217, 255, 0)');
    
    ctx.beginPath();
    ctx.moveTo(0, height);
    
    data.forEach((value, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = height - (value / 100) * height;
        ctx.lineTo(x, y);
    });
    
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Draw line
    ctx.beginPath();
    data.forEach((value, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = height - (value / 100) * height;
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    
    ctx.strokeStyle = '#00D9FF';
    ctx.lineWidth = 2;
    ctx.stroke();
}

// ============================================
// Utilities
// ============================================

// Loading Overlay
function showLoading() {
    document.getElementById('loading-overlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

// Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

// ============================================
// Initialize App
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Check for existing session
    checkSession();
    
    // Initialize based on current page
    if (document.querySelector('.dashboard-layout')) {
        initDashboardNav();
    }
});

// Handle window resize for chart
window.addEventListener('resize', () => {
    if (state.currentView === 'overview') {
        initChart();
    }
});
