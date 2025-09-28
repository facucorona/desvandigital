-- Create design_projects table for canvas editor functionality
CREATE TABLE IF NOT EXISTS design_projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL DEFAULT 'Nuevo Diseño',
  description TEXT DEFAULT 'Mi proyecto de diseño personalizado',
  canvas_data TEXT NOT NULL DEFAULT '',
  thumbnail TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_design_projects_user_id ON design_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_design_projects_created_at ON design_projects(created_at);
CREATE INDEX IF NOT EXISTS idx_design_projects_updated_at ON design_projects(updated_at);
CREATE INDEX IF NOT EXISTS idx_design_projects_name ON design_projects(name);

-- Enable Row Level Security
ALTER TABLE design_projects ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own design projects" ON design_projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own design projects" ON design_projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own design projects" ON design_projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own design projects" ON design_projects
  FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions to authenticated users
GRANT ALL PRIVILEGES ON design_projects TO authenticated;
GRANT SELECT ON design_projects TO anon;

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_design_projects_updated_at
  BEFORE UPDATE ON design_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE design_projects IS 'Stores user design projects created with the canvas editor';
COMMENT ON COLUMN design_projects.canvas_data IS 'JSON string containing Fabric.js canvas data';
COMMENT ON COLUMN design_projects.thumbnail IS 'Base64 encoded thumbnail image of the design';
COMMENT ON COLUMN design_projects.name IS 'User-defined name for the design project';
COMMENT ON COLUMN design_projects.description IS 'User-defined description of the design project';