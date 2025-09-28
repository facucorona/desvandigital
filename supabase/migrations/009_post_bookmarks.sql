-- Create post_bookmarks table for social network functionality
CREATE TABLE IF NOT EXISTS post_bookmarks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, post_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_post_bookmarks_user_id ON post_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_post_bookmarks_post_id ON post_bookmarks(post_id);
CREATE INDEX IF NOT EXISTS idx_post_bookmarks_created_at ON post_bookmarks(created_at);

-- Enable RLS
ALTER TABLE post_bookmarks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own bookmarks" ON post_bookmarks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bookmarks" ON post_bookmarks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookmarks" ON post_bookmarks
    FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL PRIVILEGES ON post_bookmarks TO authenticated;
GRANT SELECT ON post_bookmarks TO anon;