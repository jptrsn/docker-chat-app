import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { Database } from './database';
import { 
  ClientToServerEvents, 
  ServerToClientEvents, 
  InterServerEvents, 
  SocketData 
} from './types';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);

// Initialize Socket.IO with TypeScript support
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true
}));
app.use(express.json());

// Initialize database
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://chatuser:chatpass@localhost:5432/chatdb';
const db = new Database(DATABASE_URL);

// Store active users
const activeUsers = new Set<string>();

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    activeUsers: activeUsers.size
  });
});

// Get recent messages endpoint
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await db.getRecentMessages('general', 100);
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`🔗 User connected: ${socket.id}`);

  // Handle user joining
  socket.on('join', async (username: string) => {
    // Validate username
    if (!username || username.trim().length === 0) {
      socket.emit('error', 'Username is required');
      return;
    }

    if (username.length > 20) {
      socket.emit('error', 'Username must be 20 characters or less');
      return;
    }

    const validUsername = /^[a-zA-Z0-9_-]+$/.test(username);
    if (!validUsername) {
      socket.emit('error', 'Username can only contain letters, numbers, hyphens, and underscores');
      return;
    }

    // Check if username is already taken
    if (activeUsers.has(username)) {
      socket.emit('error', 'Username is already taken');
      return;
    }

    // Set socket data
    socket.data.username = username;
    socket.data.joinTime = new Date();
    
    // Add to active users
    activeUsers.add(username);
    
    // Join the general room
    await socket.join('general');
    
    // Broadcast user joined to others in the room
    socket.to('general').emit('user-joined', username);
    
    // Send current active users to everyone
    io.to('general').emit('active-users', Array.from(activeUsers));
    
    // Send chat history to the new user
    try {
      const history = await db.getChatHistory('general', 50);
      socket.emit('chat-history', history);
    } catch (error) {
      console.error('Error fetching chat history:', error);
      socket.emit('error', 'Failed to load chat history');
    }

    console.log(`👤 ${username} joined the chat`);
  });

  // Handle new messages
  socket.on('message', async (data) => {
    const { username, message } = data;
    
    // Validate data
    if (!username || !message || !socket.data.username) {
      socket.emit('error', 'Invalid message data');
      return;
    }

    // Ensure username matches socket data
    if (username !== socket.data.username) {
      socket.emit('error', 'Username mismatch');
      return;
    }

    // Validate message length
    if (message.trim().length === 0) {
      return;
    }

    if (message.length > 500) {
      socket.emit('error', 'Message too long (max 500 characters)');
      return;
    }

    try {
      // Save to database
      const savedMessage = await db.saveMessage(username, message.trim(), 'general');

      // Broadcast to all clients in the room
      io.to('general').emit('message', savedMessage);
      
      console.log(`💬 ${username}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
    } catch (error) {
      console.error('Error saving message:', error);
      socket.emit('error', 'Failed to send message');
    }
  });

  // Handle typing indicators
  socket.on('typing', (data) => {
    if (socket.data.username && data.username === socket.data.username) {
      socket.to('general').emit('typing', data);
    }
  });

  socket.on('stop-typing', (data) => {
    if (socket.data.username && data.username === socket.data.username) {
      socket.to('general').emit('stop-typing', data);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`🔌 User disconnected: ${socket.id}`);
    
    if (socket.data.username) {
      // Remove from active users
      activeUsers.delete(socket.data.username);
      
      // Broadcast user left to others in the room
      socket.to('general').emit('user-left', socket.data.username);
      
      // Update active users list
      io.to('general').emit('active-users', Array.from(activeUsers));
      
      console.log(`👋 ${socket.data.username} left the chat`);
    }
  });
});

// Error handling
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
});

// Start server
const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // Initialize database connection and tables
    await db.connect();
    await db.initializeTables();
    
    // Start the server
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Chat server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 CORS origin: ${process.env.CORS_ORIGIN || '*'}`);
      console.log(`🔗 Database: ${DATABASE_URL.split('@')[1] || 'localhost:5432/chatdb'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();