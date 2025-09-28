-- Create channels table for group chats and public channels
CREATE TABLE IF NOT EXISTS channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  type VARCHAR(20) DEFAULT 'group' CHECK (type IN ('group', 'public')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table for direct messages and channel messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
  file_url TEXT,
  file_name TEXT,
  reply_to UUID REFERENCES messages(id) ON DELETE SET NULL,
  is_edited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT messages_recipient_check CHECK (
    (receiver_id IS NOT NULL AND channel_id IS NULL) OR
    (receiver_id IS NULL AND channel_id IS NOT NULL)
  )
);

-- Create channel_members table for channel membership
CREATE TABLE IF NOT EXISTS channel_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(channel_id, user_id)
);

-- Create message_reactions table for emoji reactions
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji VARCHAR(10) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- Create user_presence table for online status
CREATE TABLE IF NOT EXISTS user_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_online BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'offline',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_channel_members_channel_id ON channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_user_id ON channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_is_online ON user_presence(is_online);

-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

-- RLS Policies for messages
CREATE POLICY "Users can view their own messages" ON messages
  FOR SELECT USING (
    auth.uid() = sender_id OR 
    auth.uid() = receiver_id OR
    (channel_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM channel_members 
      WHERE channel_id = messages.channel_id AND user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND (
      (receiver_id IS NOT NULL) OR
      (channel_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM channel_members 
        WHERE channel_id = messages.channel_id AND user_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Users can update their own messages" ON messages
  FOR UPDATE USING (auth.uid() = sender_id);

CREATE POLICY "Users can delete their own messages" ON messages
  FOR DELETE USING (auth.uid() = sender_id);

-- RLS Policies for channels
CREATE POLICY "Users can view channels they are members of" ON channels
  FOR SELECT USING (
    type = 'public' OR
    EXISTS (
      SELECT 1 FROM channel_members 
      WHERE channel_id = channels.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create channels" ON channels
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Channel owners and admins can update channels" ON channels
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM channel_members 
      WHERE channel_id = channels.id AND user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Channel owners can delete channels" ON channels
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM channel_members 
      WHERE channel_id = channels.id AND user_id = auth.uid() AND role = 'owner'
    )
  );

-- RLS Policies for channel_members
CREATE POLICY "Users can view channel members" ON channel_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM channels 
      WHERE id = channel_members.channel_id AND (
        type = 'public' OR
        EXISTS (
          SELECT 1 FROM channel_members cm2
          WHERE cm2.channel_id = channels.id AND cm2.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Channel owners and admins can manage members" ON channel_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM channel_members 
      WHERE channel_id = channel_members.channel_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
    ) OR
    user_id = auth.uid()
  );

-- RLS Policies for message_reactions
CREATE POLICY "Users can view reactions on messages they can see" ON message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM messages 
      WHERE id = message_reactions.message_id AND (
        auth.uid() = sender_id OR 
        auth.uid() = receiver_id OR
        (channel_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM channel_members 
          WHERE channel_id = messages.channel_id AND user_id = auth.uid()
        ))
      )
    )
  );

CREATE POLICY "Users can manage their own reactions" ON message_reactions
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for user_presence
CREATE POLICY "Users can view all user presence" ON user_presence
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their own presence" ON user_presence
  FOR ALL USING (auth.uid() = user_id);

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON channels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON channel_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON message_reactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_presence TO authenticated;

-- Grant permissions to anon users (for public channels)
GRANT SELECT ON channels TO anon;
GRANT SELECT ON user_presence TO anon;

-- Create function to automatically add channel creator as owner
CREATE OR REPLACE FUNCTION add_channel_creator_as_owner()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO channel_members (channel_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to add channel creator as owner
CREATE TRIGGER trigger_add_channel_creator_as_owner
  AFTER INSERT ON channels
  FOR EACH ROW
  EXECUTE FUNCTION add_channel_creator_as_owner();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update updated_at timestamp
CREATE TRIGGER trigger_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_channels_updated_at
  BEFORE UPDATE ON channels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_user_presence_updated_at
  BEFORE UPDATE ON user_presence
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to automatically create user presence on signup
CREATE OR REPLACE FUNCTION create_user_presence()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_presence (user_id, is_online, status)
  VALUES (NEW.id, FALSE, 'offline');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to create user presence on signup
CREATE TRIGGER trigger_create_user_presence
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_presence();

-- Sample channels will be created when users register and create them

-- Comments for documentation
COMMENT ON TABLE messages IS 'Stores all messages for direct conversations and channels';
COMMENT ON TABLE channels IS 'Stores channel information for group chats and public channels';
COMMENT ON TABLE channel_members IS 'Stores channel membership and roles';
COMMENT ON TABLE message_reactions IS 'Stores emoji reactions to messages';
COMMENT ON TABLE user_presence IS 'Stores user online status and presence information';