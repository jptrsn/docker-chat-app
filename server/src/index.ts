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

// Get URL metadata endpoint
app.get('/api/metadata', async (req, res) => {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    // Check if we have cached metadata
    const cachedMetadata = await db.getUrlMetadata(url);
    
    if (cachedMetadata) {
      // Check if cache is still fresh (24 hours)
      const cacheAge = Date.now() - new Date(cachedMetadata.updated_at).getTime();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      
      if (cacheAge < maxAge) {
        console.log('📋 Serving cached metadata for:', url);
        return res.json({
          title: cachedMetadata.title,
          description: cachedMetadata.description,
          image: cachedMetadata.image,
          siteName: cachedMetadata.site_name,
          favicon: cachedMetadata.favicon,
          url: cachedMetadata.url
        });
      }
    }

    // Fetch fresh metadata
    console.log('🌐 Fetching fresh metadata for:', url);
    const metadata = await fetchUrlMetadata(url);
    
    if (metadata) {
      // Save to database
      await db.saveUrlMetadata(metadata);
      
      return res.json(metadata);
    } else {
      return res.status(404).json({ error: 'Could not fetch metadata' });
    }
  } catch (error) {
    console.error('Error fetching URL metadata:', error);
    res.status(500).json({ error: 'Failed to fetch metadata' });
  }
});

// URL metadata fetching function
async function fetchUrlMetadata(url: string): Promise<any> {
  try {
    // Clean URL
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    const urlObj = new URL(cleanUrl);

    // Fetch the page
    const response = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Docker Chat Bot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // Parse HTML
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || '';

    // OpenGraph and meta tags
    const getMetaContent = (property: string, name?: string) => {
      const patterns = [
        new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i'),
      ];
      
      if (name) {
        patterns.push(
          new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
          new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i')
        );
      }

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) return match[1]?.trim();
      }
      return '';
    };

    const ogTitle = getMetaContent('og:title');
    const ogDescription = getMetaContent('og:description', 'description');
    const ogImage = getMetaContent('og:image', 'twitter:image');
    const ogSiteName = getMetaContent('og:site_name', 'twitter:site');

    // Get favicon
    let favicon = '';
    const faviconMatch = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i);
    if (faviconMatch) {
      favicon = faviconMatch[1];
      if (favicon && !favicon.startsWith('http')) {
        favicon = new URL(favicon, cleanUrl).href;
      }
    }

    const metadata = {
      url: cleanUrl,
      title: ogTitle || title,
      description: ogDescription,
      image: ogImage,
      siteName: ogSiteName || urlObj.hostname,
      favicon: favicon
    };

    // Only return if we have meaningful content
    if (metadata.title || metadata.description) {
      return metadata;
    }

    return null;
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return null;
  }
}

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