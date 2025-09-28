-- Create attic_scenes table for 3D memory palace functionality
CREATE TABLE IF NOT EXISTS attic_scenes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL DEFAULT 'Mi Palacio de Memoria',
  description TEXT DEFAULT 'Un espacio para organizar mis conocimientos',
  objects JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_attic_scenes_user_id ON attic_scenes(user_id);
CREATE INDEX IF NOT EXISTS idx_attic_scenes_created_at ON attic_scenes(created_at);
CREATE INDEX IF NOT EXISTS idx_attic_scenes_updated_at ON attic_scenes(updated_at);

-- Enable Row Level Security
ALTER TABLE attic_scenes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own attic scenes" ON attic_scenes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own attic scenes" ON attic_scenes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attic scenes" ON attic_scenes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own attic scenes" ON attic_scenes
  FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions to authenticated users
GRANT ALL PRIVILEGES ON attic_scenes TO authenticated;
GRANT SELECT ON attic_scenes TO anon;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_attic_scenes_updated_at
  BEFORE UPDATE ON attic_scenes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE attic_scenes IS 'Stores 3D memory palace scenes with objects and their properties';
COMMENT ON COLUMN attic_scenes.objects IS 'JSONB array containing 3D objects with position, rotation, scale, color, and content properties';
COMMENT ON COLUMN attic_scenes.name IS 'User-defined name for the memory palace scene';
COMMENT ON COLUMN attic_scenes.description IS 'User-defined description of the memory palace purpose';