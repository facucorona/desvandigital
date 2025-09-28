import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const poolConfig: PoolConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'desvan_digital',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
  max: 20, // maximum number of clients in the pool
  idleTimeoutMillis: 30000, // how long a client is allowed to remain idle
  connectionTimeoutMillis: 2000, // how long to wait when connecting a new client
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

const pool = new Pool(poolConfig);

// Test database connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

// Helper function to execute queries
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('📊 Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('❌ Database query error:', error);
    throw error;
  }
};

// Helper function to get a client from the pool
export const getClient = async () => {
  return await pool.connect();
};

// Helper function for transactions
export const transaction = async (callback: (client: any) => Promise<any>) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Initialize database tables
export const initializeDatabase = async () => {
  try {
    console.log('🔄 Initializing database tables...');
    
    // Create users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        avatar_url TEXT,
        bio TEXT,
        location VARCHAR(255),
        website VARCHAR(255),
        social_links JSONB DEFAULT '{}',
        role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        subscription_type VARCHAR(20) DEFAULT 'free' CHECK (subscription_type IN ('free', 'premium', 'pro')),
        is_active BOOLEAN DEFAULT true,
        email_verified BOOLEAN DEFAULT false,
        last_login TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create study_routes table
    await query(`
      CREATE TABLE IF NOT EXISTS study_routes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        content JSONB NOT NULL DEFAULT '{}',
        difficulty_level VARCHAR(20) DEFAULT 'beginner' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
        estimated_duration INTEGER DEFAULT 0,
        tags TEXT[] DEFAULT '{}',
        author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_premium BOOLEAN DEFAULT false,
        is_published BOOLEAN DEFAULT false,
        views_count INTEGER DEFAULT 0,
        likes_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create products table
    await query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL DEFAULT 0,
        category VARCHAR(100) NOT NULL,
        image_url TEXT,
        stock_quantity INTEGER DEFAULT 0,
        is_digital BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create attic_objects table
    await query(`
      CREATE TABLE IF NOT EXISTS attic_objects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        object_type VARCHAR(20) NOT NULL CHECK (object_type IN ('memory', 'note', 'link', 'file')),
        content JSONB NOT NULL DEFAULT '{}',
        position_x DECIMAL(10,3) DEFAULT 0,
        position_y DECIMAL(10,3) DEFAULT 0,
        position_z DECIMAL(10,3) DEFAULT 0,
        rotation_x DECIMAL(10,3) DEFAULT 0,
        rotation_y DECIMAL(10,3) DEFAULT 0,
        rotation_z DECIMAL(10,3) DEFAULT 0,
        scale DECIMAL(10,3) DEFAULT 1,
        color VARCHAR(7),
        texture_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create dashboard_items table
    await query(`
      CREATE TABLE IF NOT EXISTS dashboard_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        content JSONB NOT NULL DEFAULT '{}',
        item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('note', 'image', 'video', 'audio', 'document')),
        file_url TEXT,
        tags TEXT[] DEFAULT '{}',
        is_favorite BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create object_links table
    await query(`
      CREATE TABLE IF NOT EXISTS object_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        from_object_id UUID NOT NULL REFERENCES attic_objects(id) ON DELETE CASCADE,
        to_object_id UUID NOT NULL REFERENCES attic_objects(id) ON DELETE CASCADE,
        link_type VARCHAR(20) DEFAULT 'association' CHECK (link_type IN ('association', 'sequence', 'hierarchy')),
        strength INTEGER DEFAULT 5 CHECK (strength >= 1 AND strength <= 10),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(from_object_id, to_object_id)
      )
    `);

    // Create messages table
    await query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file')),
        file_url TEXT,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create orders table
    await query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        total_amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
        shipping_address TEXT,
        payment_method VARCHAR(50),
        payment_status VARCHAR(20) DEFAULT 'pending',
        items JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create posts table for social network
    await query(`
      CREATE TABLE IF NOT EXISTS posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        image_url TEXT,
        likes_count INTEGER DEFAULT 0,
        comments_count INTEGER DEFAULT 0,
        is_published BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create comments table
    await query(`
      CREATE TABLE IF NOT EXISTS comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create likes table
    await query(`
      CREATE TABLE IF NOT EXISTS likes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, post_id)
      )
    `);

    // Create indexes for better performance
    await query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await query('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
    await query('CREATE INDEX IF NOT EXISTS idx_study_routes_author ON study_routes(author_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_attic_objects_user ON attic_objects(user_id)');
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

export default pool;
export { pool };