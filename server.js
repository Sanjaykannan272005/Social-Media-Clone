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

// Session Middleware
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || (() => {
    console.warn("⚠️ SESSION_SECRET is missing in .env. Using fallback key.");
    return 'your-secret-key';
  })(),
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,               // ✅ Force false for HTTP on Render
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    sameSite: 'lax'              // ✅ 'strict' can block session cookie; use 'lax'
  }
});

// Use session middleware in Express
app.use(sessionMiddleware);

// app.use(passport.initialize());
// app.use(passport.session());
app.use(flash());

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

app.get('/', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
});

// ✅ Optional: Session debug route
app.get('/session-debug', (req, res) => {
  res.json({ session: req.session });
});

// Socket.io with session support
io.use((socket, next) => {
  try {
    const req = socket.request;
    if (req.headers.cookie) {
      const sessionID = req.headers.cookie.split(';').find(c => c.trim().startsWith('connect.sid='));
      if (sessionID) {
        console.log('Socket connection with session ID:', sessionID);
      }
    }
    sessionMiddleware(req, {}, next);
  } catch (err) {
    console.error('Socket session error:', err);
    next(err);
  }
});

// Socket.io events
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  if (socket.request.session && socket.request.session.user) {
    const userId = socket.request.session.user.id;
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined their room`);
    socket.broadcast.emit('user_status', { userId, status: 'online' });
    socket.userId = userId;
  }

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (socket.userId) {
      socket.broadcast.emit('user_status', { userId: socket.userId, status: 'offline' });
    }
  });

  socket.on('privateMessage', (data, callback) => {
    try {
      console.log('Received private message for user:', data.recipient_id);
      io.emit('newMessage', data.message);
      socket.emit('messageSent', { 
        messageId: data.message.id || 'temp_' + Date.now(),
        recipientId: data.recipient_id,
        status: 'sent',
        timestamp: new Date()
      });
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

  socket.on('typing', (data) => {
    io.to(`user_${data.recipient_id}`).emit('userTyping', {
      userId: data.sender_id,
      isTyping: data.isTyping
    });
  });

  socket.on('messageRead', (data) => {
    io.to(`user_${data.sender_id}`).emit('messageStatus', {
      messageIds: data.messageIds,
      status: 'read',
      timestamp: new Date()
    });
  });

  socket.on('syncMessages', (data, callback) => {
    if (typeof callback === 'function') {
      callback({ success: true, timestamp: new Date() });
    }
  });
});

// Error handler
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
