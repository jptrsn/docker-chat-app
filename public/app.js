class ChatApp {
    constructor() {
        this.socket = null;
        this.username = null;
        this.isTyping = false;
        this.typingTimer = null;
        
        this.initializeElements();
        this.bindEvents();
        this.initializeSocket();
    }

    initializeElements() {
        // Screens
        this.loginScreen = document.getElementById('login-screen');
        this.chatScreen = document.getElementById('chat-screen');
        
        // Login elements
        this.usernameInput = document.getElementById('username-input');
        this.joinBtn = document.getElementById('join-btn');
        
        // Chat elements
        this.messagesContainer = document.getElementById('messages');
        this.messageInput = document.getElementById('message-input');
        this.sendBtn = document.getElementById('send-btn');
        this.userList = document.getElementById('user-list');
        this.userCountNumber = document.getElementById('user-count-number');
        this.leaveBtn = document.getElementById('leave-btn');
        this.typingIndicator = document.getElementById('typing-indicator');
        this.connectionStatus = document.getElementById('connection-status');
    }

    bindEvents() {
        // Login events
        this.joinBtn.addEventListener('click', () => this.joinChat());
        this.usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinChat();
        });
        
        // Chat events
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            } else {
                this.handleTyping();
            }
        });
        
        this.messageInput.addEventListener('keyup', () => {
            this.handleStopTyping();
        });
        
        this.leaveBtn.addEventListener('click', () => this.leaveChat());
    }

    initializeSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.updateConnectionStatus('connected', 'Connected');
        });
        
        this.socket.on('disconnect', () => {
            this.updateConnectionStatus('disconnected', 'Disconnected');
        });
        
        this.socket.on('connect_error', () => {
            this.updateConnectionStatus('disconnected', 'Connection Error');
        });
        
        this.socket.on('message', (data) => {
            this.displayMessage(data);
        });
        
        this.socket.on('chat-history', (messages) => {
            this.loadChatHistory(messages);
        });
        
        this.socket.on('user-joined', (username) => {
            this.displaySystemMessage(`${username} joined the chat`);
        });
        
        this.socket.on('user-left', (username) => {
            this.displaySystemMessage(`${username} left the chat`);
        });
        
        this.socket.on('active-users', (users) => {
            this.updateUserList(users);
        });
        
        this.socket.on('typing', (data) => {
            this.showTypingIndicator(data.username);
        });
        
        this.socket.on('stop-typing', (data) => {
            this.hideTypingIndicator(data.username);
        });
        
        this.socket.on('error', (message) => {
            this.showError(message);
        });
    }

    joinChat() {
        const username = this.usernameInput.value.trim();
        
        if (!username) {
            this.showError('Please enter a username');
            return;
        }
        
        if (username.length > 20) {
            this.showError('Username must be 20 characters or less');
            return;
        }
        
        // Basic validation for safe usernames
        const validUsername = /^[a-zA-Z0-9_-]+$/.test(username);
        if (!validUsername) {
            this.showError('Username can only contain letters, numbers, hyphens, and underscores');
            return;
        }
        
        this.username = username;
        this.socket.emit('join', username);
        this.showChatScreen();
    }

    leaveChat() {
        this.socket.disconnect();
        this.showLoginScreen();
        this.clearChat();
        this.username = null;
        this.usernameInput.value = '';
    }

    showChatScreen() {
        this.loginScreen.classList.remove('active');
        this.chatScreen.classList.add('active');
        this.messageInput.focus();
    }

    showLoginScreen() {
        this.chatScreen.classList.remove('active');
        this.loginScreen.classList.add('active');
        this.usernameInput.focus();
    }

    sendMessage() {
        const message = this.messageInput.value.trim();
        
        if (!message || !this.username) return;
        
        this.socket.emit('message', {
            username: this.username,
            message: message
        });
        
        this.messageInput.value = '';
        this.handleStopTyping();
    }

    displayMessage(data, isOwn = false) {
        const messageElement = document.createElement('div');
        messageElement.className = `message${isOwn ? ' own' : ''}`;
        
        const isSystemMessage = data.username === 'System';
        if (isSystemMessage) {
            messageElement.classList.add('system');
        }
        
        const timestamp = new Date(data.timestamp || Date.now()).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="username">${this.escapeHtml(data.username)}</span>
                <span class="timestamp">${timestamp}</span>
            </div>
            <div class="message-content">${this.escapeHtml(data.message)}</div>
        `;
        
        this.messagesContainer.appendChild(messageElement);
        this.scrollToBottom();
    }

    displaySystemMessage(message) {
        this.displayMessage({
            username: 'System',
            message: message,
            timestamp: new Date()
        });
    }

    loadChatHistory(messages) {
        this.messagesContainer.innerHTML = '';
        messages.forEach(message => {
            const isOwn = message.username === this.username;
            this.displayMessage(message, isOwn);
        });
    }

    updateUserList(users) {
        this.userList.innerHTML = '';
        this.userCountNumber.textContent = users.length;
        
        users.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = 'user-item';
            userElement.innerHTML = `
                <i class="fas fa-circle"></i>
                <span>${this.escapeHtml(user)}</span>
            `;
            this.userList.appendChild(userElement);
        });
    }

    handleTyping() {
        if (!this.isTyping && this.username) {
            this.isTyping = true;
            this.socket.emit('typing', { username: this.username });
        }
        
        clearTimeout(this.typingTimer);
        this.typingTimer = setTimeout(() => {
            this.handleStopTyping();
        }, 1000);
    }

    handleStopTyping() {
        if (this.isTyping) {
            this.isTyping = false;
            this.socket.emit('stop-typing', { username: this.username });
        }
        clearTimeout(this.typingTimer);
    }

    showTypingIndicator(username) {
        if (username !== this.username) {
            this.typingIndicator.textContent = `${username} is typing...`;
            setTimeout(() => {
                if (this.typingIndicator.textContent === `${username} is typing...`) {
                    this.typingIndicator.textContent = '';
                }
            }, 3000);
        }
    }

    hideTypingIndicator(username) {
        if (this.typingIndicator.textContent === `${username} is typing...`) {
            this.typingIndicator.textContent = '';
        }
    }

    updateConnectionStatus(status, message) {
        this.connectionStatus.className = `connection-status ${status}`;
        this.connectionStatus.innerHTML = `
            <i class="fas fa-${status === 'connected' ? 'wifi' : status === 'connecting' ? 'spinner fa-spin' : 'exclamation-triangle'}"></i>
            <span>${message}</span>
        `;
        
        if (status === 'connected') {
            setTimeout(() => {
                this.connectionStatus.style.opacity = '0';
            }, 2000);
        } else {
            this.connectionStatus.style.opacity = '1';
        }
    }

    clearChat() {
        this.messagesContainer.innerHTML = '';
        this.userList.innerHTML = '';
        this.userCountNumber.textContent = '0';
        this.typingIndicator.textContent = '';
    }

    scrollToBottom() {
        const container = document.getElementById('messages-container');
        container.scrollTop = container.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        // Simple error display - in production you might want a more sophisticated system
        alert(message);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new ChatApp();
    
    // Focus username input on load
    document.getElementById('username-input').focus();
});