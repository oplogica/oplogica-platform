class OpLogicaChat {
    constructor() {
        this.isOpen = false;
        this.messageCount = 0;
        this.maxFreeMessages = 5;
        this.isTyping = false;
        this.init();
    }
    
    init() {
        this.createWidget();
        this.bindEvents();
        this.addWelcomeMessage();
        this.loadMessageCount();
    }
    
    createWidget() {
        const toggle = document.createElement('button');
        toggle.className = 'chat-toggle';
        toggle.innerHTML = '<svg class="chat-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg><svg class="close-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
        
        const chatWindow = document.createElement('div');
        chatWindow.className = 'chat-window';
        chatWindow.id = 'chat-window';
        chatWindow.innerHTML = '<div class="chat-header"><div class="chat-header-avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12 Q12 6 16 12 Q12 18 8 12"/></svg></div><div class="chat-header-info"><h4>OpLogica AI</h4><p>Online</p></div><span class="chat-free-badge">Free Trial</span></div><div class="chat-messages" id="chat-messages"></div><div class="chat-input-container" id="chat-input-container"><div class="chat-input-wrapper"><input type="text" class="chat-input" id="chat-input" placeholder="Ask OpLogica anything..."><button class="chat-send-btn" id="chat-send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg></button></div><div class="messages-remaining"><strong id="remaining-count">5</strong> free messages remaining</div></div>';
        
        document.body.appendChild(toggle);
        document.body.appendChild(chatWindow);
        
        this.toggle = toggle;
        this.chatWindow = chatWindow;
        this.messagesContainer = document.getElementById('chat-messages');
        this.input = document.getElementById('chat-input');
        this.sendBtn = document.getElementById('chat-send');
        this.inputContainer = document.getElementById('chat-input-container');
        this.remainingCount = document.getElementById('remaining-count');
    }
    
    bindEvents() {
        this.toggle.addEventListener('click', () => this.toggleChat());
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.input.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.sendMessage(); });
    }
    
    toggleChat() {
        this.isOpen = !this.isOpen;
        this.toggle.classList.toggle('active', this.isOpen);
        this.chatWindow.classList.toggle('active', this.isOpen);
        if (this.isOpen) this.input.focus();
    }
    
    addWelcomeMessage() {
        this.addMessage('assistant', '👋 Welcome to <strong>OpLogica</strong>!<br><br>I can help you analyze decisions, evaluate risks, and provide intelligent insights.<br><br><strong>Try me!</strong> Ask anything.');
    }
    
    loadMessageCount() {
        const saved = localStorage.getItem('oplogica_msg_count');
        if (saved) {
            this.messageCount = parseInt(saved);
            this.updateRemainingCount();
            if (this.messageCount >= this.maxFreeMessages) this.showLimitReached();
        }
    }
    
    updateRemainingCount() {
        const remaining = Math.max(0, this.maxFreeMessages - this.messageCount);
        this.remainingCount.textContent = remaining;
    }
    
    addMessage(role, content) {
        const msg = document.createElement('div');
        msg.className = 'chat-message ' + role;
        const avatar = role === 'assistant' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12 Q12 6 16 12 Q12 18 8 12"/></svg>' : 'U';
        msg.innerHTML = '<div class="message-avatar">' + avatar + '</div><div class="message-content">' + content + '</div>';
        this.messagesContainer.appendChild(msg);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
    
    showTyping() {
        const t = document.createElement('div');
        t.className = 'chat-message assistant';
        t.id = 'typing-indicator';
        t.innerHTML = '<div class="message-avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg></div><div class="typing-indicator"><span></span><span></span><span></span></div>';
        this.messagesContainer.appendChild(t);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
    
    hideTyping() { const t = document.getElementById('typing-indicator'); if (t) t.remove(); }
    
    showLimitReached() {
        this.inputContainer.innerHTML = '<div class="chat-limit-message"><p>🎉 You have used all free messages!</p><button class="btn-primary" onclick="showPage(\'register-page\'); oplogicaChat.toggleChat();">Create Free Account</button></div>';
    }
    
    async sendMessage() {
        const text = this.input.value.trim();
        if (!text || this.isTyping) return;
        if (this.messageCount >= this.maxFreeMessages) { this.showLimitReached(); return; }
        
        this.addMessage('user', text);
        this.input.value = '';
        this.messageCount++;
        localStorage.setItem('oplogica_msg_count', this.messageCount.toString());
        this.updateRemainingCount();
        
        this.isTyping = true;
        this.sendBtn.disabled = true;
        this.showTyping();
        
        try {
            const response = await fetch('/api/ai/claude', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: text, analysisType: 'default' })
            });
            const data = await response.json();
            this.hideTyping();
            this.addMessage('assistant', data.success ? data.response.replace(/\n/g, '<br>') : 'Sorry, an error occurred.');
        } catch (error) {
            this.hideTyping();
            this.addMessage('assistant', 'Connection error. Please try again.');
        }
        
        this.isTyping = false;
        this.sendBtn.disabled = false;
        if (this.messageCount >= this.maxFreeMessages) setTimeout(() => this.showLimitReached(), 1000);
    }
}

document.addEventListener('DOMContentLoaded', () => { if (document.getElementById('landing-page')) window.oplogicaChat = new OpLogicaChat(); });
