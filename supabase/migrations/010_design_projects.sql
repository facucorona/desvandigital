-- Create design_projects table
CREATE TABLE IF NOT EXISTS design_projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    canvas_data JSONB NOT NULL,
    thumbnail TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_design_projects_user_id ON design_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_design_projects_created_at ON design_projects(created_at);
CREATE INDEX IF NOT EXISTS idx_design_projects_updated_at ON design_projects(updated_at);

-- Enable RLS
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

-- Grant permissions
GRANT ALL PRIVILEGES ON design_projects TO authenticated;
GRANT SELECT ON design_projects TO anon;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_design_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_design_projects_updated_at
    BEFORE UPDATE ON design_projects
    FOR EACH ROW
    EXECUTE FUNCTION update_design_projects_updated_at();