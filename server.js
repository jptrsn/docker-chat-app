const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://chatuser:chatpass@localhost:5432/chatdb',
  ssl: process.env.NODE_ENV === 'production' ? false : false
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to database:', err);
  } else {
    console.log('Successfully connected to PostgreSQL database');
    release();
  }
});

// Store active users
const activeUsers = new Set();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user joining
  socket.on('join', async (username) => {
    socket.username = username;
    activeUsers.add(username);
    
    // Broadcast user joined
    socket.broadcast.emit('user-joined', username);
    
    // Send current active users
    io.emit('active-users', Array.from(activeUsers));
    
    // Send chat history
    try {
      const result = await pool.query(
        'SELECT username, message, timestamp FROM messages WHERE room = $1 ORDER BY timestamp DESC LIMIT 50',
        ['general']
      );
      
      socket.emit('chat-history', result.rows.reverse());
    } catch (err) {
      console.error('Error fetching chat history:', err);
    }
  });

  // Handle new messages
  socket.on('message', async (data) => {
    const { username, message } = data;
    
    if (!username || !message) {
      return;
    }

    try {
      // Save to database
      const result = await pool.query(
        'INSERT INTO messages (username, message, room) VALUES ($1, $2, $3) RETURNING id, timestamp',
        [username, message, 'general']
      );

      const messageData = {
        id: result.rows[0].id,
        username,
        message,
        timestamp: result.rows[0].timestamp,
        room: 'general'
      };

      // Broadcast to all clients
      io.emit('message', messageData);
      
    } catch (err) {
      console.error('Error saving message:', err);
      socket.emit('error', 'Failed to send message');
    }
  });

  // Handle user typing
  socket.on('typing', (data) => {
    socket.broadcast.emit('typing', data);
  });

  socket.on('stop-typing', (data) => {
    socket.broadcast.emit('stop-typing', data);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    if (socket.username) {
      activeUsers.delete(socket.username);
      socket.broadcast.emit('user-left', socket.username);
      io.emit('active-users', Array.from(activeUsers));
    }
  });
});

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/messages', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM messages WHERE room = $1 ORDER BY timestamp DESC LIMIT 100',
      ['general']
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Chat server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});