require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const flash = require('connect-flash');
const pool = require('./db');
const http = require('http');
const { Server } = require('socket.io');

// Create Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // In production, set this to your specific domain
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Make io available in controllers
app.set('io', io);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Create session middleware that can be shared with Socket.io
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // HTTPS in production
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    sameSite: 'strict'
  }
});

// Use session middleware in Express
app.use(sessionMiddleware);

// Initialize passport
// app.use(passport.initialize());
// app.use(passport.session());
app.use(flash());

// Configure passport
// require('./config/passport')(passport, pool);

// Debug middleware
app.use((req, res, next) => {
  console.log('Session ID:', req.sessionID);
  console.log('User:', req.session.user);
  next();
});

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Routes
app.use('/', require('./routes/authRoutes'));
app.use('/', require('./routes/userRoutes'));
app.use('/', require('./routes/settingsRoutes'));
app.use('/api', require('./routes/apiRoutes'));
app.use('/api/posts', require('./routes/postRoutes'));
app.get('/posts', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }
  res.render('posts', { user: req.session.user });
});
app.use('/api/comments', require('./routes/commentRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));

// Root route
app.get('/', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
});

// Socket.io setup with session support
io.use((socket, next) => {
  try {
    const req = socket.request;
    if (req.headers.cookie) {
      // Parse session from cookie directly if needed
      const sessionID = req.headers.cookie.split(';').find(c => c.trim().startsWith('connect.sid='));
      if (sessionID) {
        console.log('Socket connection with session ID:', sessionID);
      }
    }
    
    // Continue with session middleware
    sessionMiddleware(req, {}, next);
  } catch (err) {
    console.error('Socket session error:', err);
    next(err);
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  // Store user information if authenticated
  if (socket.request.session && socket.request.session.user) {
    const userId = socket.request.session.user.id;
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined their room`);
    
    // Notify user is online
    socket.broadcast.emit('user_status', { userId, status: 'online' });
    
    // Store user ID in socket for later use
    socket.userId = userId;
  }
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Notify user is offline if they were authenticated
    if (socket.userId) {
      socket.broadcast.emit('user_status', { userId: socket.userId, status: 'offline' });
    }
  });
  
  // Handle private messages with improved delivery
  socket.on('privateMessage', (data, callback) => {
    try {
      console.log('Received private message for user:', data.recipient_id);
      
      // Broadcast to all clients (for testing)
      io.emit('newMessage', data.message);
      
      // Acknowledge message receipt to sender
      socket.emit('messageSent', { 
        messageId: data.message.id || 'temp_' + Date.now(),
        recipientId: data.recipient_id,
        status: 'sent',
        timestamp: new Date()
      });
      
      // Send callback if provided
      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (err) {
      console.error('Error handling private message:', err);
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Failed to deliver message' });
      }
    }
  });
  
  // Handle typing indicators
  socket.on('typing', (data) => {
    io.to(`user_${data.recipient_id}`).emit('userTyping', {
      userId: data.sender_id,
      isTyping: data.isTyping
    });
  });
  
  // Handle message read receipts
  socket.on('messageRead', (data) => {
    io.to(`user_${data.sender_id}`).emit('messageStatus', {
      messageIds: data.messageIds,
      status: 'read',
      timestamp: new Date()
    });
  });
  
  // Handle reconnection and sync
  socket.on('syncMessages', (data, callback) => {
    if (typeof callback === 'function') {
      callback({ success: true, timestamp: new Date() });
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Server Error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});