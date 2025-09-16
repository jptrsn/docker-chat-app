import { Pool, PoolClient } from 'pg';
import { Message } from './types';

export class Database {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err: Error) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  async connect(): Promise<void> {
    try {
      const client: PoolClient = await this.pool.connect();
      console.log('✅ Successfully connected to PostgreSQL database');
      client.release();
    } catch (error) {
      console.error('❌ Error connecting to database:', error);
      throw error;
    }
  }

  async initializeTables(): Promise<void> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) NOT NULL,
          message TEXT NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          room VARCHAR(50) DEFAULT 'general'
        );
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room);
      `);

      // Insert welcome message if it doesn't exist
      const welcomeCheck = await client.query(
        `SELECT 1 FROM messages WHERE username = 'System' AND message LIKE '%Welcome to the Docker Bootcamp%'`
      );

      if (welcomeCheck.rows.length === 0) {
        await client.query(
          `INSERT INTO messages (username, message, room) VALUES ($1, $2, $3)`,
          ['System', 'Welcome to the Docker Bootcamp Chat Room! 🚀', 'general']
        );
      }

      console.log('✅ Database tables initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing database tables:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async saveMessage(username: string, message: string, room: string = 'general'): Promise<Message> {
    const client: PoolClient = await this.pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO messages (username, message, room) VALUES ($1, $2, $3) RETURNING id, timestamp`,
        [username, message, room]
      );

      return {
        id: result.rows[0]?.id,
        username,
        message,
        timestamp: result.rows[0]?.timestamp,
        room
      };
    } catch (error) {
      console.error('Error saving message:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getChatHistory(room: string = 'general', limit: number = 50): Promise<Message[]> {
    const client: PoolClient = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT id, username, message, timestamp, room FROM messages 
         WHERE room = $1 ORDER BY timestamp DESC LIMIT $2`,
        [room, limit]
      );

      return result.rows.reverse();
    } catch (error) {
      console.error('Error fetching chat history:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getRecentMessages(room: string = 'general', limit: number = 100): Promise<Message[]> {
    const client: PoolClient = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT id, username, message, timestamp, room FROM messages 
         WHERE room = $1 ORDER BY timestamp DESC LIMIT $2`,
        [room, limit]
      );

      return result.rows;
    } catch (error) {
      console.error('Error fetching recent messages:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    console.log('🔌 Database connection pool closed');
  }
}