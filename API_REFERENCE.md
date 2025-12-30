# Skilloc Chatbox - Complete API & Code Reference

## 📋 Table of Contents
1. [Frontend Code Structure](#frontend-code-structure)
2. [Backend API Reference](#backend-api-reference)
3. [Socket.IO Events](#socketio-events)
4. [Data Models](#data-models)
5. [Code Snippets](#code-snippets)

---

## Frontend Code Structure

### Main Files

#### 1. **chatbox.html**
The main chat interface with HTML structure.

**Key Elements:**
```html
<div class="chat-container">
  <header class="chat-header">
    <h1>Skilloc Chat</h1>
    <button id="backBtn">Back</button>
  </header>
  
  <div class="chat-main">
    <!-- Worker List Panel -->
    <div class="worker-list-panel">
      <input id="searchWorkers" placeholder="Search workers...">
      <select id="categoryFilter">
        <option value="">All Categories</option>
        <option value="electrician">Electrician</option>
        <!-- ... -->
      </select>
      <div id="workerList"></div>
    </div>
    
    <!-- Chat Window -->
    <div class="chat-window">
      <div id="messagesContainer"></div>
      <input id="messageInput" placeholder="Type message...">
      <button id="sendBtn">Send</button>
    </div>
  </div>
</div>
```

#### 2. **chatbox.css**
Complete styling with:
- Gradient color scheme (cyan #00ffff, magenta #ff00ff)
- Responsive layout (mobile, tablet, desktop)
- Animations and transitions
- Custom scrollbars
- Message bubble styling

**Key Classes:**
- `.chat-container` - Main wrapper
- `.worker-list-panel` - Left sidebar
- `.chat-window` - Main chat area
- `.message` - Individual message container
- `.message.sent` - Outgoing messages (gradient background)
- `.message.received` - Incoming messages (dark background)
- `.worker-item` - Worker list item
- `.worker-item.active` - Selected worker highlight

#### 3. **public/js/chat.js**
Core chat application logic.

**Class: ChatApp**

**Constructor & Initialization:**
```javascript
class ChatApp {
    constructor() {
        this.socket = null;              // Socket.IO instance
        this.token = null;               // JWT token
        this.userId = null;              // Current user ID
        this.userType = null;            // User type ("client")
        this.currentChatWorkerId = null; // Selected worker ID
        this.workers = [];               // List of online workers
        this.messages = new Map();       // Conversation history
        this.isConnected = false;        // Socket connection status
        
        this.initializeElements();       // Get DOM elements
        this.attachEventListeners();     // Add event handlers
        this.checkAuth();                // Verify authentication
    }
}
```

**Key Methods:**

**1. `checkAuth()`**
```javascript
checkAuth() {
    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userId');
    const userType = localStorage.getItem('userType');

    if (!token || !userId || userType !== 'client') {
        window.location.href = 'client.html'; // Redirect to login
        return;
    }

    this.token = token;
    this.userId = userId;
    this.userType = userType;
    this.initializeSocketIO();
    this.loadWorkers();
}
```

**2. `initializeSocketIO()`**
```javascript
initializeSocketIO() {
    this.socket = io(); // Create Socket.IO connection

    // Authenticate
    this.socket.emit('authenticate', { token: this.token });

    // Listen for events
    this.socket.on('authenticated', (data) => {
        console.log('Socket authenticated:', data);
        this.isConnected = true;
    });

    this.socket.on('message', (msg) => {
        this.handleIncomingMessage(msg);
    });

    this.socket.on('disconnect', () => {
        this.isConnected = false;
    });
}
```

**3. `loadWorkers()`**
```javascript
async loadWorkers() {
    try {
        const response = await fetch('/api/workerdb');
        const data = await response.json();
        
        if (data.workers && Array.isArray(data.workers)) {
            this.workers = data.workers.filter(w => w && w.id);
            this.displayWorkers(this.workers);
        }
    } catch (error) {
        console.error('Error loading workers:', error);
        this.showError('Failed to load workers list');
    }
}
```

**4. `selectWorker(workerId)`**
```javascript
async selectWorker(workerId) {
    this.currentChatWorkerId = workerId;
    const worker = this.workers.find(w => w.id === workerId);
    
    // Update UI
    this.elements.noChatSelected.style.display = 'none';
    this.elements.chatActive.style.display = 'flex';
    
    // Update worker info
    const initials = `${(worker.firstName || 'W')[0]}${(worker.lastName || 'K')[0]}`.toUpperCase();
    this.elements.workerInitials.textContent = initials;
    this.elements.selectedWorkerName.textContent = `${worker.firstName} ${worker.lastName || ''}`;
    
    // Load conversation history
    await this.loadConversation(workerId);
}
```

**5. `sendMessage()`**
```javascript
async sendMessage() {
    const text = this.elements.messageInput.value.trim();
    
    if (!text || !this.currentChatWorkerId) return;

    const toId = this.currentChatWorkerId;
    this.elements.messageInput.disabled = true;
    this.elements.sendBtn.disabled = true;

    try {
        if (this.isConnected && this.socket) {
            // Real-time via Socket.IO
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

            const data = await response.json();
            this.handleOutgoingMessage(data.message);
        }

        this.elements.messageInput.value = '';
    } finally {
        this.elements.messageInput.disabled = false;
        this.elements.sendBtn.disabled = false;
    }
}
```

**6. `displayMessages(convId)`**
```javascript
displayMessages(convId) {
    const messages = this.messages.get(convId) || [];
    
    if (messages.length === 0) {
        this.elements.messagesContainer.innerHTML = 
            '<div class="messages-empty">No messages yet</div>';
        return;
    }

    const html = messages.map(msg => this.createMessageHTML(msg)).join('');
    this.elements.messagesContainer.innerHTML = html;
    
    // Scroll to bottom
    this.elements.messagesContainer.scrollTop = 
        this.elements.messagesContainer.scrollHeight;
}
```

---

## Backend API Reference

### Authentication Endpoints

#### 1. Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "client@example.com",
  "password": "password123",
  "type": "client"
}

Response (200):
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "1234567890",
    "email": "client@example.com",
    "type": "client"
  }
}

Error (401):
{
  "error": "Invalid credentials"
}
```

#### 2. Get Current User Profile
```
GET /api/me
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "user": {
    "id": "1234567890",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "1234567890",
    "city": "New York",
    "address": "123 Main St",
    "services": ["plumbing", "electrical"],
    "radius": 5
  }
}
```

### Worker Endpoints

#### 1. Get Online Workers
```
GET /api/workerdb

Response (200):
{
  "workers": [
    {
      "id": "9876543210",
      "email": "worker@example.com",
      "firstName": "Jane",
      "lastName": "Smith",
      "profession": "electrician",
      "phone": "9876543210",
      "lastLogin": "2025-12-30T10:30:00Z",
      "status": "online"
    }
  ]
}
```

#### 2. Search Workers
```
POST /api/client/search
Authorization: Bearer <token>
Content-Type: application/json

{
  "category": "electrician",
  "lat": 40.7128,
  "lng": -74.0060
}

Response (200):
{
  "workers": [
    {
      "id": "9876543210",
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane@example.com",
      "phone": "9876543210",
      "profession": "electrician",
      "latitude": 40.7140,
      "longitude": -74.0060
    }
  ]
}
```

### Message Endpoints

#### 1. Get Message History
```
GET /api/messages?clientId=1234&workerId=5678

Response (200):
{
  "messages": [
    {
      "from": "1234",
      "to": "5678",
      "text": "Hello, are you available?",
      "ts": "2025-12-30T10:30:45.123Z",
      "conversationId": "conv:1234_5678"
    }
  ]
}
```

#### 2. Send Message
```
POST /api/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "fromId": "1234567890",
  "toId": "9876543210",
  "text": "What's your rate for electrical work?"
}

Response (200):
{
  "success": true,
  "message": {
    "from": "1234567890",
    "to": "9876543210",
    "text": "What's your rate for electrical work?",
    "ts": "2025-12-30T10:35:20.456Z"
  }
}
```

### Registration Endpoints

#### 1. Register Client
```
POST /api/client/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "1234567890",
  "city": "New York",
  "address": "123 Main St",
  "services": ["plumbing"],
  "radius": 5,
  "password": "securePassword123"
}

Response (200):
{
  "success": true,
  "user": {
    "id": "1234567890",
    "email": "john@example.com"
  }
}

Error (400):
{
  "error": "Email already registered"
}
```

---

## Socket.IO Events

### Client-to-Server Events

#### 1. Authenticate Socket
```javascript
socket.emit('authenticate', {
  token: 'jwt_token_here'
});
```

#### 2. Send Private Message
```javascript
socket.emit('private_message', {
  toId: 'worker_id_here',
  text: 'Hello, are you available?'
});
```

### Server-to-Client Events

#### 1. Authentication Success
```javascript
socket.on('authenticated', (data) => {
  console.log(data);
  // { id: 'user_id', type: 'client' }
});
```

#### 2. Receive Message
```javascript
socket.on('message', (msg) => {
  console.log(msg);
  // { 
  //   from: 'worker_id', 
  //   to: 'client_id',
  //   text: 'I am available',
  //   ts: '2025-12-30T10:35:20Z'
  // }
});
```

#### 3. Authentication Error
```javascript
socket.on('unauthorized', (error) => {
  console.error(error);
  // { error: 'Invalid token' }
});
```

#### 4. Connection/Disconnection
```javascript
socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});
```

---

## Data Models

### Client Model
```javascript
{
  "id": "1234567890",              // Unique identifier (timestamp)
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "1234567890",
  "city": "New York",
  "address": "123 Main St",
  "services": ["plumbing", "electrical"],
  "radius": 5,                      // Service radius in km
  "latitude": 40.7128,              // Optional location
  "longitude": -74.0060,
  "password": "$2a$10$...",         // Bcrypt hashed password
  "failedAttempts": 0,              // For account lockout
  "lockedUntil": null               // Lockout timestamp
}
```

### Worker Model
```javascript
{
  "id": "9876543210",
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@example.com",
  "phone": "9876543210",
  "profession": "electrician",
  "experience": 5,                  // Years of experience
  "skills": "Rewiring, Installations",
  "certifications": "Licensed Electrician",
  "hourlyRate": 50,
  "serviceRadius": 10,
  "latitude": 40.7140,
  "longitude": -74.0060,
  "password": "$2a$10$...",         // Bcrypt hashed
  "lastLogin": "2025-12-30T10:30:00Z"
}
```

### Worker DB Model (Online Workers)
```javascript
{
  "id": "9876543210",
  "email": "jane@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "profession": "electrician",
  "phone": "9876543210",
  "lastLogin": "2025-12-30T10:30:00Z",
  "status": "online"
}
```

### Message Model
```javascript
{
  "from": "1234567890",             // Sender user ID
  "to": "9876543210",               // Recipient user ID
  "text": "Hello, are you available?",
  "ts": "2025-12-30T10:35:20.456Z", // Timestamp
  "conversationId": "conv:1234_9876543210"
}
```

---

## Code Snippets

### Quick Start - Login
```javascript
// In client.html
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, type: 'client' })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userId', data.user.id);
        localStorage.setItem('userType', data.user.type);

        window.location.href = 'chatbox.html';
    } catch (err) {
        alert(err.message);
    }
}
```

### Send Message via Socket.IO
```javascript
if (this.isConnected && this.socket) {
    this.socket.emit('private_message', {
        toId: 'worker_id_here',
        text: messageText
    });
} else {
    // Fallback to REST API
    fetch('/api/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
            fromId: this.userId,
            toId: 'worker_id',
            text: messageText
        })
    });
}
```

### Display Workers in List
```javascript
displayWorkers(workers) {
    const html = workers.map(worker => `
        <div class="worker-item" data-worker-id="${worker.id}">
            <div class="worker-avatar-small">
                ${worker.firstName[0]}${worker.lastName[0]}
            </div>
            <div class="worker-item-info">
                <div class="worker-item-name">
                    ${worker.firstName} ${worker.lastName}
                </div>
                <div class="worker-item-profession">
                    ${worker.profession}
                </div>
            </div>
            <div class="worker-item-status"></div>
        </div>
    `).join('');
    
    this.elements.workerList.innerHTML = html;
}
```

### Conversation ID Generation
```javascript
generateConversationId(userId1, userId2) {
    // Sort IDs to ensure consistency
    return `conv:${[userId1, userId2].sort().join('_')}`;
}

// Usage
const convId = this.generateConversationId('client_id', 'worker_id');
// Result: 'conv:client_id_worker_id' (if client_id < worker_id alphabetically)
```

---

## Security Notes

1. **JWT Tokens**: Used for REST API authentication
   - Stored in `localStorage` on client
   - Verified server-side for each request
   - Expires after configured duration

2. **Password Hashing**: All passwords use bcrypt
   - Salt rounds: 10
   - Never stored in plain text

3. **CORS**: Enabled to allow cross-origin requests
   - Configured in server.js

4. **Account Lockout**: 5 failed login attempts trigger 15-minute lockout
   - Prevents brute force attacks

---

## Performance Tips

1. **Message Pagination**: Load older messages on demand
2. **Debounce Search**: Add delay before filtering workers
3. **Image Optimization**: Compress avatars and media
4. **Lazy Load**: Load worker profiles on demand
5. **Caching**: Cache worker list locally

---

**Document Version**: 1.0  
**Last Updated**: December 30, 2025
