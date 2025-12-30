# Skilloc Chatbox Implementation Guide

## Overview
This guide explains the complete chatbox system for Skilloc, which enables clients to chat with available workers in real-time using Socket.IO with REST API fallback.

---

## 📁 File Structure

### Frontend Files
- **chatbox.html** - Main chat interface page
- **chatbox.css** - Modern styling for the chat application
- **public/js/chat.js** - Chat application logic with Socket.IO integration

### Backend (Server-side - Already Configured)
- **server.js** - Node.js Express server with Socket.IO
- **data/messages.json** - Persistent message storage
- **data/worker.db** - Online workers database
- **data/workers.json** - Worker profiles
- **data/clients.json** - Client profiles

---

## 🚀 Getting Started

### 1. Start the Server
```bash
cd c:\Users\ROHIT DAS\OneDrive\Desktop\Skilloc
npm install
node server.js
```

The server will start at `http://localhost:3000`

### 2. Access the Application

**For Clients:**
1. Go to `http://localhost:3000/client.html`
2. **Login Tab** - Sign in with existing credentials
3. **Register Tab** - Create a new client account
4. After login, you'll be redirected to `chatbox.html`

**For Workers:**
- Workers should login through their own portal
- Their status will appear in the worker.db file when online

---

## 🔐 Authentication Flow

### Client Login
1. User enters email and password on `client.html`
2. Frontend sends credentials to `/api/auth/login` endpoint
3. Server validates and returns JWT token
4. Token is stored in `localStorage`:
   - `authToken` - JWT for API requests
   - `userId` - Client ID
   - `userType` - "client" 
5. User is redirected to `chatbox.html`

### Socket.IO Authentication
When the chat page loads:
1. JavaScript reads the JWT token from localStorage
2. Initializes Socket.IO connection
3. Emits 'authenticate' event with token
4. Server verifies token and establishes authenticated connection

---

## 💬 Chat Features

### Worker List Panel
- **Search** - Filter workers by name or skill
- **Category Filter** - Filter by profession (Electrician, Plumber, etc.)
- **Online Status** - Green dot indicates online workers
- **Worker Initials** - Avatar with first and last name initials

### Chat Window
- **Conversation History** - All previous messages displayed
- **Real-time Messaging** - Uses Socket.IO for instant delivery
- **Message Timestamps** - Local time display for each message
- **Auto-scroll** - Window automatically scrolls to latest message
- **Empty State** - Helpful message when no worker selected

### Message Sending
- Type message in input field
- Click "Send" button or press Enter
- Message appears immediately (optimistic UI)
- Socket.IO sends to recipient if online
- Falls back to REST API if disconnected

---

## 📊 Message Storage

Messages are persisted in `data/messages.json`:

```json
{
  "from": "client_id",
  "to": "worker_id",
  "text": "Message content",
  "ts": "2025-12-30T10:30:45.123Z",
  "conversationId": "conv:client_id_worker_id"
}
```

### Conversation ID Format
- Combination of client ID and worker ID
- Sorted alphabetically to ensure consistency
- Example: `conv:1234_5678`

---

## 🔌 Socket.IO Events

### Client Events (Sent by Frontend)
```javascript
// Authenticate socket connection
socket.emit('authenticate', { token: jwtToken });

// Send private message
socket.emit('private_message', { 
  toId: workerId, 
  text: messageContent 
});
```

### Server Events (Received by Frontend)
```javascript
// Socket authenticated successfully
socket.on('authenticated', (data) => {
  console.log('Connected:', data);
});

// Incoming message from worker
socket.on('message', (msg) => {
  // msg contains: { from, to, text, ts }
});

// Authentication failed
socket.on('unauthorized', (error) => {
  console.error('Auth failed:', error);
});
```

---

## 📡 REST API Endpoints

### Get Workers List
```
GET /api/workerdb
Response: { workers: [array of online workers] }
```

### Get Message History
```
GET /api/messages?clientId=XXX&workerId=YYY
Response: { messages: [array of messages] }
```

### Send Message (Fallback)
```
POST /api/messages
Headers: { Authorization: "Bearer <token>" }
Body: { fromId, toId, text }
Response: { success: true, message: {...} }
```

### Authentication
```
POST /api/auth/login
Body: { email, password, type: "client" }
Response: { token, user: { id, email, type } }
```

---

## 🎨 Styling Details

### Color Scheme
- **Primary Accent**: Cyan (#00ffff)
- **Secondary Accent**: Magenta (#ff00ff)
- **Background**: Dark blue (#0f0f1e)
- **Text**: White with various opacities

### Responsive Breakpoints
- **Desktop** (>1024px) - Side-by-side layout
- **Tablet** (768px-1024px) - Adjusted sizing
- **Mobile** (<480px) - Stacked layout with horizontal worker list

### Key Components
- **Header** - Gradient background with back button
- **Worker Panel** - Left sidebar with searchable list
- **Chat Window** - Main message area
- **Input Area** - Message composition with send button
- **Toast Notifications** - Error/success messages

---

## 🔧 Backend Configuration

The server is configured with:
- **Express.js** - Web framework
- **Socket.IO** - Real-time communication
- **JWT** - Token-based authentication
- **Bcryptjs** - Password hashing
- **CORS** - Cross-origin requests enabled

### Key Endpoints Already Implemented
- `/api/auth/login` - User login
- `/api/client/register` - New client registration
- `/api/workerdb` - Get online workers
- `/api/messages` - Message CRUD operations
- `/api/me` - Get authenticated user info

---

## 🚨 Error Handling

### Frontend Error Handling
1. **Network Errors** - Shows toast notification
2. **Authentication Errors** - Redirects to login
3. **Validation Errors** - Alert messages
4. **Socket Disconnection** - Falls back to REST API

### Message Validation
- Empty messages are rejected
- No worker selected error
- Token validation on each request

---

## 📱 LocalStorage Keys

```javascript
// Set on login
localStorage.authToken      // JWT token
localStorage.userId         // Client ID
localStorage.userType       // "client"

// These persist until logout
// Checked on chatbox.html page load
```

---

## 🔄 Message Flow Diagram

```
Client UI
   ↓
JavaScript Event Listener
   ↓
Send Message (Socket.IO or REST)
   ↓
Server receives message
   ↓
Message persisted to JSON
   ↓
Server routes to recipient socket
   ↓
Recipient receives in real-time
   ↓
Message displayed in chat window
```

---

## 🎯 Usage Examples

### Login Process
1. Open `http://localhost:3000/client.html`
2. Click "Login" tab
3. Enter email: `testclient@example.com`
4. Enter password: `test123` (or your password)
5. Click "Login to Chat"
6. You'll be redirected to the chatbox

### Sending a Message
1. Click on a worker from the left panel
2. Worker details appear in the header
3. Type message in the input field
4. Press Enter or click Send
5. Message appears in the chat with timestamp
6. Worker receives it instantly if online

### Searching Workers
1. Use the search box to filter by name
2. Use the category dropdown to filter by profession
3. Only online workers appear in the list
4. Click a worker to open the conversation

---

## 🐛 Troubleshooting

### Messages Not Sending
- Check if you're authenticated (look for token in localStorage)
- Verify server is running
- Check browser console for errors
- Try refreshing the page to reconnect Socket.IO

### Worker List Empty
- Ensure workers have logged in (they need to be in worker.db)
- Check if workers' profession matches filter
- Look at server logs for any errors

### Can't Login
- Verify email/password are correct
- Check if account was registered
- Look at server console for authentication errors
- Try registering a new account

### Messages Not Loading
- Check network tab in developer tools
- Verify JWT token is valid
- Try clearing localStorage and re-login
- Restart the server

---

## 📝 Notes

- Messages are stored in `data/messages.json` permanently
- Worker availability is tracked in `data/worker.db`
- JWT tokens expire after the configured duration
- Socket.IO automatically handles reconnection
- REST API fallback ensures messages are sent even if WebSocket fails
- All passwords are bcrypt-hashed
- Client coordinates can be stored for location-based searches

---

## 🔮 Future Enhancements

Potential features to add:
- Typing indicators
- Read receipts
- Message editing/deletion
- File/image sharing
- Voice messages
- Worker rating system
- Message search
- Chat history export
- Push notifications
- Offline message queue

---

## ✅ Testing Checklist

- [ ] Server starts without errors
- [ ] Client can register a new account
- [ ] Client can login with credentials
- [ ] Chatbox page loads after login
- [ ] Worker list displays
- [ ] Can search/filter workers
- [ ] Can select a worker
- [ ] Can send a message
- [ ] Messages persist after refresh
- [ ] Can logout and login again
- [ ] Multiple chats with different workers work

---

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review server logs
3. Check browser console (F12 → Console)
4. Verify all files are in correct locations
5. Ensure Node.js and npm are installed

---

**Last Updated:** December 30, 2025
**Version:** 1.0
