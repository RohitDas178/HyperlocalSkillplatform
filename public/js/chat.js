// ===== SKILLOC CHAT APPLICATION =====
// Real-time messaging between clients and workers with Socket.IO

class ChatApp {
    constructor() {
        this.socket = null;
        this.token = null;
        this.userId = null;
        this.userType = null;
        this.currentChatWorkerId = null;
        this.workers = [];
        this.messages = new Map(); // conversationId -> [messages]
        this.isConnected = false;
        this.typingTimeout = null;
        
        this.initializeElements();
        this.attachEventListeners();
        this.checkAuth();
    }

    initializeElements() {
        this.elements = {
            backBtn: document.getElementById('backBtn'),
            searchWorkers: document.getElementById('searchWorkers'),
            categoryFilter: document.getElementById('categoryFilter'),
            workerList: document.getElementById('workerList'),
            noChatSelected: document.getElementById('noChatSelected'),
            chatActive: document.getElementById('chatActive'),
            messagesContainer: document.getElementById('messagesContainer'),
            messageInput: document.getElementById('messageInput'),
            sendBtn: document.getElementById('sendBtn'),
            selectedWorkerName: document.getElementById('selectedWorkerName'),
            selectedWorkerProfession: document.getElementById('selectedWorkerProfession'),
            workerInitials: document.getElementById('workerInitials'),
            onlineStatus: document.getElementById('onlineStatus'),
            closeChat: document.getElementById('closeChat'),
            typingIndicator: document.getElementById('typingIndicator'),
            errorToast: document.getElementById('errorToast'),
            successToast: document.getElementById('successToast')
        };
    }

    attachEventListeners() {
        this.elements.backBtn.addEventListener('click', () => this.logout());
        this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        this.elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        this.elements.closeChat.addEventListener('click', () => this.closeChat());
        this.elements.searchWorkers.addEventListener('input', () => this.filterWorkers());
        this.elements.categoryFilter.addEventListener('change', () => this.filterWorkers());
    }

    checkAuth() {
        const token = localStorage.getItem('authToken');
        const userId = localStorage.getItem('userId');
        const userType = localStorage.getItem('userType');

        if (!token || !userId || userType !== 'client') {
            // Redirect to login
            window.location.href = 'client.html';
            return;
        }

        this.token = token;
        this.userId = userId;
        this.userType = userType;
        this.initializeSocketIO();
        this.loadWorkers();
    }

    initializeSocketIO() {
        // Initialize Socket.IO connection
        this.socket = io();

        // Authenticate with the server
        this.socket.emit('authenticate', { token: this.token });

        // Listen for authentication response
        this.socket.on('authenticated', (data) => {
            console.log('Socket authenticated:', data);
            this.isConnected = true;
        });

        this.socket.on('unauthorized', (data) => {
            console.error('Socket authentication failed:', data);
            this.showError('Socket connection failed');
            window.location.href = 'client.html';
        });

        // Listen for incoming messages
        this.socket.on('message', (msg) => {
            this.handleIncomingMessage(msg);
        });

        this.socket.on('disconnect', () => {
            this.isConnected = false;
            console.log('Disconnected from server');
        });

        this.socket.on('connect', () => {
            console.log('Connected to server');
            // Re-authenticate after reconnect
            this.socket.emit('authenticate', { token: this.token });
        });
    }

    async loadWorkers() {
        try {
            const response = await fetch('/api/workerdb');
            const data = await response.json();
            
            if (data.workers && Array.isArray(data.workers)) {
                this.workers = data.workers.filter(w => w && w.id);
                this.displayWorkers(this.workers);
            } else {
                this.showError('Failed to load workers');
            }
        } catch (error) {
            console.error('Error loading workers:', error);
            this.showError('Failed to load workers list');
        }
    }

    displayWorkers(workers) {
        const html = workers.length === 0 
            ? '<p class="loading">No workers available</p>'
            : workers.map(worker => this.createWorkerItemHTML(worker)).join('');
        
        this.elements.workerList.innerHTML = html;
        
        // Attach click listeners to worker items
        document.querySelectorAll('.worker-item').forEach(item => {
            item.addEventListener('click', () => {
                const workerId = item.dataset.workerId;
                this.selectWorker(workerId);
            });
        });
    }

    createWorkerItemHTML(worker) {
        const initials = `${(worker.firstName || 'W')[0]}${(worker.lastName || 'K')[0]}`.toUpperCase();
        return `
            <div class="worker-item" data-worker-id="${worker.id}">
                <div class="worker-avatar-small">${initials}</div>
                <div class="worker-item-info">
                    <div class="worker-item-name">${worker.firstName} ${worker.lastName || ''}</div>
                    <div class="worker-item-profession">${worker.profession || 'Service Provider'}</div>
                </div>
                <div class="worker-item-status"></div>
            </div>
        `;
    }

    filterWorkers() {
        const searchTerm = this.elements.searchWorkers.value.toLowerCase();
        const category = this.elements.categoryFilter.value.toLowerCase();

        const filtered = this.workers.filter(worker => {
            const matchesSearch = !searchTerm || 
                worker.firstName.toLowerCase().includes(searchTerm) ||
                worker.lastName.toLowerCase().includes(searchTerm) ||
                (worker.profession || '').toLowerCase().includes(searchTerm);
            
            const matchesCategory = !category || 
                (worker.profession || '').toLowerCase().includes(category);
            
            return matchesSearch && matchesCategory;
        });

        this.displayWorkers(filtered);
    }

    async selectWorker(workerId) {
        this.currentChatWorkerId = workerId;
        const worker = this.workers.find(w => w.id === workerId);
        
        if (!worker) return;

        // Update UI
        document.querySelectorAll('.worker-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-worker-id="${workerId}"]`)?.classList.add('active');

        // Show chat window
        this.elements.noChatSelected.style.display = 'none';
        this.elements.chatActive.style.display = 'flex';

        // Update worker info
        const initials = `${(worker.firstName || 'W')[0]}${(worker.lastName || 'K')[0]}`.toUpperCase();
        this.elements.workerInitials.textContent = initials;
        this.elements.selectedWorkerName.textContent = `${worker.firstName} ${worker.lastName || ''}`;
        this.elements.selectedWorkerProfession.textContent = worker.profession || 'Service Provider';

        // Load conversation history
        await this.loadConversation(workerId);

        // Focus on input
        this.elements.messageInput.focus();
    }

    async loadConversation(workerId) {
        try {
            const response = await fetch(
                `/api/messages?clientId=${this.userId}&workerId=${workerId}`
            );
            const data = await response.json();

            const convId = this.generateConversationId(this.userId, workerId);
            this.messages.set(convId, data.messages || []);

            this.displayMessages(convId);
        } catch (error) {
            console.error('Error loading conversation:', error);
            this.elements.messagesContainer.innerHTML = '<div class="messages-empty">No messages yet</div>';
        }
    }

    generateConversationId(userId1, userId2) {
        return `conv:${[userId1, userId2].sort().join('_')}`;
    }

    displayMessages(convId) {
        const messages = this.messages.get(convId) || [];
        
        if (messages.length === 0) {
            this.elements.messagesContainer.innerHTML = '<div class="messages-empty">No messages yet. Start the conversation!</div>';
            return;
        }

        const html = messages.map(msg => this.createMessageHTML(msg)).join('');
        this.elements.messagesContainer.innerHTML = html;

        // Scroll to bottom
        this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
    }

    createMessageHTML(msg) {
        const isSent = msg.from === this.userId;
        const messageClass = isSent ? 'sent' : 'received';
        const timestamp = new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="message ${messageClass}">
                <div>
                    <div class="message-bubble">${this.escapeHtml(msg.text)}</div>
                    <div class="message-time">${timestamp}</div>
                </div>
            </div>
        `;
    }

    async sendMessage() {
        const text = this.elements.messageInput.value.trim();
        
        if (!text) return;
        if (!this.currentChatWorkerId) {
            this.showError('No worker selected');
            return;
        }

        const toId = this.currentChatWorkerId;

        // Disable input while sending
        this.elements.messageInput.disabled = true;
        this.elements.sendBtn.disabled = true;

        try {
            if (this.isConnected && this.socket) {
                // Use Socket.IO for real-time delivery
                this.socket.emit('private_message', {
                    toId: toId,
                    text: text
                });
            } else {
                // Fallback to REST API
                const response = await fetch('/api/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    },
                    body: JSON.stringify({
                        fromId: this.userId,
                        toId: toId,
                        text: text
                    })
                });

                if (!response.ok) {
                    this.showError('Failed to send message');
                    return;
                }

                const data = await response.json();
                this.handleOutgoingMessage(data.message);
            }

            // Clear input
            this.elements.messageInput.value = '';
            this.elements.messageInput.focus();

        } catch (error) {
            console.error('Error sending message:', error);
            this.showError('Failed to send message');
        } finally {
            this.elements.messageInput.disabled = false;
            this.elements.sendBtn.disabled = false;
        }
    }

    handleIncomingMessage(msg) {
        // Check if this message is for the current conversation
        if (msg.from === this.currentChatWorkerId) {
            const convId = this.generateConversationId(this.userId, msg.from);
            const messages = this.messages.get(convId) || [];
            messages.push(msg);
            this.messages.set(convId, messages);
            this.displayMessages(convId);
        }
    }

    handleOutgoingMessage(msg) {
        const convId = this.generateConversationId(msg.from, msg.to);
        let messages = this.messages.get(convId) || [];
        messages.push(msg);
        this.messages.set(convId, messages);
        this.displayMessages(convId);
    }

    closeChat() {
        this.currentChatWorkerId = null;
        this.elements.noChatSelected.style.display = 'flex';
        this.elements.chatActive.style.display = 'none';
        document.querySelectorAll('.worker-item').forEach(item => {
            item.classList.remove('active');
        });
    }

    logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('userType');
        if (this.socket) {
            this.socket.disconnect();
        }
        window.location.href = 'client.html';
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showToast(message, type = 'error') {
        const toast = type === 'error' 
            ? this.elements.errorToast 
            : this.elements.successToast;
        
        toast.textContent = message;
        toast.style.display = 'block';

        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('ChatApp initializing...');
    new ChatApp();
});
