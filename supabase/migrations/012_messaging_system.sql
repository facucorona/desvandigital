-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255),
    is_group BOOLEAN DEFAULT false,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create conversation_participants table
CREATE TABLE IF NOT EXISTS conversation_participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_admin BOOLEAN DEFAULT false,
    UNIQUE(conversation_id, user_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
    file_url TEXT,
    file_name TEXT,
    file_size INTEGER,
    reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    edited_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create message_reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_conversations_created_by ON conversations(created_by);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation_id ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id ON conversation_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id ON messages(reply_to_id);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions(user_id);

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
CREATE POLICY "Users can view conversations they participate in" ON conversations
    FOR SELECT USING (
        id IN (
            SELECT conversation_id 
            FROM conversation_participants 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create conversations" ON conversations
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Conversation creators and admins can update" ON conversations
    FOR UPDATE USING (
        created_by = auth.uid() OR
        id IN (
            SELECT conversation_id 
            FROM conversation_participants 
            WHERE user_id = auth.uid() AND is_admin = true
        )
    );

-- RLS Policies for conversation_participants
CREATE POLICY "Users can view participants of their conversations" ON conversation_participants
    FOR SELECT USING (
        conversation_id IN (
            SELECT conversation_id 
            FROM conversation_participants 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can join conversations" ON conversation_participants
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own participation" ON conversation_participants
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can leave conversations" ON conversation_participants
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their conversations" ON messages
    FOR SELECT USING (
        conversation_id IN (
            SELECT conversation_id 
            FROM conversation_participants 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can send messages to their conversations" ON messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        conversation_id IN (
            SELECT conversation_id 
            FROM conversation_participants 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own messages" ON messages
    FOR UPDATE USING (auth.uid() = sender_id);

CREATE POLICY "Users can delete their own messages" ON messages
    FOR DELETE USING (auth.uid() = sender_id);

-- RLS Policies for message_reactions
CREATE POLICY "Users can view reactions in their conversations" ON message_reactions
    FOR SELECT USING (
        message_id IN (
            SELECT m.id 
            FROM messages m
            JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
            WHERE cp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can add reactions" ON message_reactions
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        message_id IN (
            SELECT m.id 
            FROM messages m
            JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
            WHERE cp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can remove their own reactions" ON message_reactions
    FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL PRIVILEGES ON conversations TO authenticated;
GRANT ALL PRIVILEGES ON conversation_participants TO authenticated;
GRANT ALL PRIVILEGES ON messages TO authenticated;
GRANT ALL PRIVILEGES ON message_reactions TO authenticated;

GRANT SELECT ON conversations TO anon;
GRANT SELECT ON conversation_participants TO anon;
GRANT SELECT ON messages TO anon;
GRANT SELECT ON message_reactions TO anon;