import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

dotenv.config();

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database path - create database in the project root
const dbPath = path.join(__dirname, '../../database.sqlite');

let db: Database<sqlite3.Database, sqlite3.Statement> | null = null;

// Initialize SQLite database connection
const initializeConnection = async () => {
  if (!db) {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    
    // Enable foreign keys
    await db.exec('PRAGMA foreign_keys = ON;');
    
    console.log('✅ Connected to SQLite database at:', dbPath);
  }
  return db;
};

// Helper function to execute queries
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const database = await initializeConnection();
    
    // Convert PostgreSQL-style $1, $2 placeholders to SQLite ? placeholders
    const sqliteQuery = text.replace(/\$(\d+)/g, '?');
    
    let result;
    if (sqliteQuery.trim().toUpperCase().startsWith('SELECT')) {
      result = await database.all(sqliteQuery, params);
      const duration = Date.now() - start;
      console.log('📊 Executed query', { text: sqliteQuery, duration, rows: result.length });
      return { rows: result, rowCount: result.length };
    } else {
      result = await database.run(sqliteQuery, params);
      const duration = Date.now() - start;
      console.log('📊 Executed query', { text: sqliteQuery, duration, changes: result.changes });
      return { rows: [], rowCount: result.changes || 0, lastID: result.lastID };
    }
  } catch (error) {
    console.error('❌ Database query error:', error);
    throw error;
  }
};

// Helper function to get the database instance
export const getClient = async () => {
  return await initializeConnection();
};

// Helper function for transactions
export const transaction = async (callback: (client: any) => Promise<any>) => {
  const database = await initializeConnection();
  try {
    await database.exec('BEGIN TRANSACTION');
    const result = await callback(database);
    await database.exec('COMMIT');
    return result;
  } catch (error) {
    await database.exec('ROLLBACK');
    throw error;
  }
};

// Initialize database tables
export const initializeDatabase = async () => {
  try {
    console.log('🔄 Initializing database tables...');
    
    // Create users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        avatar_url TEXT,
        bio TEXT,
        location TEXT,
        website TEXT,
        social_links TEXT DEFAULT '{}',
        role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        subscription_type TEXT DEFAULT 'free' CHECK (subscription_type IN ('free', 'premium', 'pro')),
        is_active INTEGER DEFAULT 1,
        email_verified INTEGER DEFAULT 0,
        last_login TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Create study_routes table
    await query(`
      CREATE TABLE IF NOT EXISTS study_routes (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        title TEXT NOT NULL,
        description TEXT,
        content TEXT NOT NULL DEFAULT '{}',
        difficulty_level TEXT DEFAULT 'beginner' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
        estimated_duration INTEGER DEFAULT 0,
        tags TEXT DEFAULT '[]',
        author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_premium INTEGER DEFAULT 0,
        is_published INTEGER DEFAULT 0,
        views_count INTEGER DEFAULT 0,
        likes_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Create products table
    await query(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL DEFAULT 0,
        category TEXT NOT NULL,
        image_url TEXT,
        stock_quantity INTEGER DEFAULT 0,
        is_digital INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Create attic_objects table
    await query(`
      CREATE TABLE IF NOT EXISTS attic_objects (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        condition TEXT DEFAULT 'good' CHECK (condition IN ('excellent', 'good', 'fair', 'poor')),
        estimated_value REAL DEFAULT 0,
        image_url TEXT,
        location TEXT,
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_for_sale INTEGER DEFAULT 0,
        sale_price REAL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Create dashboard_items table
    await query(`
      CREATE TABLE IF NOT EXISTS dashboard_items (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '{}',
        item_type TEXT NOT NULL CHECK (item_type IN ('note', 'image', 'video', 'audio', 'document')),
        file_url TEXT,
        tags TEXT DEFAULT '[]',
        is_favorite INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Create object_links table
    await query(`
      CREATE TABLE IF NOT EXISTS object_links (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        from_object_id TEXT NOT NULL REFERENCES attic_objects(id) ON DELETE CASCADE,
        to_object_id TEXT NOT NULL REFERENCES attic_objects(id) ON DELETE CASCADE,
        link_type TEXT DEFAULT 'association' CHECK (link_type IN ('association', 'sequence', 'hierarchy')),
        strength INTEGER DEFAULT 5 CHECK (strength >= 1 AND strength <= 10),
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(from_object_id, to_object_id)
      )
    `);

    // Create messages table
    await query(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file')),
        file_url TEXT,
        is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Create orders table
    await query(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        total_amount REAL NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
        shipping_address TEXT,
        payment_method TEXT,
        payment_status TEXT DEFAULT 'pending',
        items TEXT NOT NULL DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Create posts table for social network
    await query(`
      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        image_url TEXT,
        likes_count INTEGER DEFAULT 0,
        comments_count INTEGER DEFAULT 0,
        is_published INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Create comments table
    await query(`
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Create likes table
    await query(`
      CREATE TABLE IF NOT EXISTS likes (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, post_id)
      )
    `);

    // Create indexes for better performance
    await query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await query('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
    await query('CREATE INDEX IF NOT EXISTS idx_study_routes_author ON study_routes(author_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_attic_objects_owner ON attic_objects(owner_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_dashboard_items_user ON dashboard_items(user_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_likes_user_post ON likes(user_id, post_id)');

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
};

// Initialize database on startup
initializeDatabase().catch(console.error);

export default db;
export { db as pool };