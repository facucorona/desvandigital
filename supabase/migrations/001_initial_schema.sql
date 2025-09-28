-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    user_type VARCHAR(20) DEFAULT 'regular' CHECK (user_type IN ('regular', 'creator', 'brand', 'admin')),
    is_verified BOOLEAN DEFAULT false,
    profile_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create study_routes table
CREATE TABLE study_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    difficulty_level VARCHAR(20) CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    price DECIMAL(10,2) DEFAULT 0.00,
    content_structure JSONB DEFAULT '{}',
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create products table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    product_type VARCHAR(20) CHECK (product_type IN ('physical', 'virtual')),
    price DECIMAL(10,2) NOT NULL,
    metadata JSONB DEFAULT '{}',
    image_url VARCHAR(500),
    stock_quantity INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create attic_objects table
CREATE TABLE attic_objects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    position JSONB NOT NULL DEFAULT '{"x": 0, "y": 0, "z": 0}',
    rotation JSONB DEFAULT '{"x": 0, "y": 0, "z": 0}',
    scale JSONB DEFAULT '{"x": 1, "y": 1, "z": 1}',
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create dashboard_items table
CREATE TABLE dashboard_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT,
    file_url VARCHAR(500),
    metadata JSONB DEFAULT '{}',
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create object_links table
CREATE TABLE object_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attic_object_id UUID NOT NULL REFERENCES attic_objects(id) ON DELETE CASCADE,
    dashboard_item_id UUID NOT NULL REFERENCES dashboard_items(id) ON DELETE CASCADE,
    link_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
    shipping_info JSONB DEFAULT '{}',
    payment_info JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create order_items table
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create route_subscriptions table
CREATE TABLE route_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    study_route_id UUID NOT NULL REFERENCES study_routes(id) ON DELETE CASCADE,
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    progress JSONB DEFAULT '{}',
    UNIQUE(user_id, study_route_id)
);

-- Create route_comments table
CREATE TABLE route_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    study_route_id UUID NOT NULL REFERENCES study_routes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create social_posts table
CREATE TABLE social_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    image_url VARCHAR(500),
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create post_likes table
CREATE TABLE post_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- Create post_comments table
CREATE TABLE post_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_user_type ON users(user_type);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

CREATE INDEX idx_study_routes_creator_id ON study_routes(creator_id);
CREATE INDEX idx_study_routes_category ON study_routes(category);
CREATE INDEX idx_study_routes_published ON study_routes(is_published);

CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_type ON products(product_type);
CREATE INDEX idx_products_active ON products(is_active);

CREATE INDEX idx_attic_objects_user_id ON attic_objects(user_id);
CREATE INDEX idx_attic_objects_product_id ON attic_objects(product_id);
CREATE INDEX idx_attic_objects_public ON attic_objects(is_public);

CREATE INDEX idx_dashboard_items_user_id ON dashboard_items(user_id);
CREATE INDEX idx_dashboard_items_type ON dashboard_items(item_type);

CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

CREATE INDEX idx_social_posts_user_id ON social_posts(user_id);
CREATE INDEX idx_social_posts_created_at ON social_posts(created_at DESC);

CREATE INDEX idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX idx_post_comments_post_id ON post_comments(post_id);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE attic_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE object_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

-- Grant permissions to anon and authenticated roles
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Insert initial data
-- Admin user (password: admin123)
INSERT INTO users (email, password_hash, name, user_type, is_verified)
VALUES ('admin@desvandigital.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrador', 'admin', true);

-- Sample products
INSERT INTO products (name, description, category, product_type, price, metadata, image_url, stock_quantity)
VALUES 
('Escritorio Virtual', 'Escritorio clásico para organizar documentos digitales', 'furniture', 'virtual', 0.00, '{"model": "desk_basic.glb", "dimensions": {"width": 120, "height": 75, "depth": 60}}', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20wooden%20desk%20with%20clean%20lines%20and%20minimalist%20design%2C%203D%20render&image_size=square', 999),
('Estantería Virtual', 'Estantería moderna para libros y objetos de estudio', 'furniture', 'virtual', 5.99, '{"model": "bookshelf.glb", "dimensions": {"width": 80, "height": 180, "depth": 30}}', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20bookshelf%20with%20multiple%20shelves%2C%20clean%20design%2C%203D%20render&image_size=square', 999),
('Lámpara de Estudio', 'Iluminación LED ajustable para el área de trabajo', 'lighting', 'virtual', 2.99, '{"model": "desk_lamp.glb", "light_properties": {"intensity": 0.8, "color": "#ffffff"}}', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20adjustable%20desk%20lamp%20with%20LED%20light%2C%20sleek%20design%2C%203D%20render&image_size=square', 999),
('Silla Ergonómica', 'Silla cómoda para largas sesiones de estudio', 'furniture', 'virtual', 8.99, '{"model": "office_chair.glb", "ergonomic_features": ["lumbar_support", "adjustable_height"]}', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=ergonomic%20office%20chair%20with%20modern%20design%2C%20comfortable%20padding%2C%203D%20render&image_size=square', 999),
('Mesa de Café', 'Mesa auxiliar para descansos y reuniones informales', 'furniture', 'virtual', 4.99, '{"model": "coffee_table.glb", "dimensions": {"width": 100, "height": 45, "depth": 50}}', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20coffee%20table%20with%20glass%20top%20and%20wooden%20legs%2C%203D%20render&image_size=square', 999);

-- Sample study route
INSERT INTO study_routes (creator_id, title, description, category, difficulty_level, price, content_structure, is_published)
SELECT 
    u.id,
    'Introducción al Palacio de Memoria',
    'Aprende las técnicas fundamentales para crear y utilizar palacios de memoria efectivos',
    'memory_techniques',
    'beginner',
    9.99,
    '{
        "modules": [
            {
                "title": "Fundamentos del Palacio de Memoria",
                "duration": "30 min",
                "content_type": "video"
            },
            {
                "title": "Creando tu Primer Palacio",
                "duration": "45 min",
                "content_type": "interactive"
            },
            {
                "title": "Práctica Guiada",
                "duration": "60 min",
                "content_type": "exercise"
            }
        ],
        "total_duration": "135 min",
        "prerequisites": [],
        "learning_objectives": [
            "Comprender los principios del palacio de memoria",
            "Crear un palacio de memoria personal",
            "Aplicar técnicas de memorización espacial"
        ]
    }',
    true
FROM users u WHERE u.user_type = 'admin' LIMIT 1;