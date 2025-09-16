-- PostgreSQL initialization script for Docker Bootcamp Chat
-- This script runs as postgres superuser and creates everything from scratch

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE chatdb'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'chatdb')\gexec

-- Create user if it doesn't exist  
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'chatuser') THEN
      CREATE USER chatuser WITH ENCRYPTED PASSWORD 'chatpass';
   END IF;
END
$$;

-- Grant permissions on database
GRANT ALL PRIVILEGES ON DATABASE chatdb TO chatuser;

-- Connect to chatdb database
\c chatdb

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO chatuser;

-- Create the messages table
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    room VARCHAR(50) DEFAULT 'general'
);

-- Grant permissions on table and sequence to chatuser
GRANT ALL PRIVILEGES ON TABLE messages TO chatuser;
GRANT ALL PRIVILEGES ON SEQUENCE messages_id_seq TO chatuser;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room);
CREATE INDEX IF NOT EXISTS idx_messages_username ON messages(username);

-- Insert welcome message if it doesn't exist
INSERT INTO messages (username, message, room) 
SELECT 'System', 'Welcome to the Docker Bootcamp Chat Room! 🚀 This message was created during database initialization.', 'general'
WHERE NOT EXISTS (SELECT 1 FROM messages WHERE username = 'System' AND message LIKE '%Welcome to the Docker Bootcamp%');

-- Insert some sample data for testing (optional)
INSERT INTO messages (username, message, room) 
SELECT 'System', 'Server is ready to receive connections. Happy chatting!', 'general'
WHERE NOT EXISTS (SELECT 1 FROM messages WHERE username = 'System' AND message LIKE '%Server is ready%');

-- Show completion message
\echo '✅ Database chatdb created and initialized successfully!'
\echo '📊 Current message count:'
SELECT COUNT(*) as total_messages FROM messages;