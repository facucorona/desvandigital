-- Create user_profiles table for extended user information
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  location TEXT,
  website TEXT,
  phone TEXT,
  birth_date DATE,
  preferences JSONB DEFAULT '{
    "notifications": true,
    "newsletter": false,
    "public_profile": true,
    "show_activity": true
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_full_name ON user_profiles(full_name);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON user_profiles(created_at);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Users can delete their own profile
CREATE POLICY "Users can delete own profile" ON user_profiles
  FOR DELETE USING (auth.uid() = id);

-- Public profiles can be viewed by authenticated users
CREATE POLICY "Public profiles viewable by authenticated users" ON user_profiles
  FOR SELECT USING (
    auth.role() = 'authenticated' AND 
    (preferences->>'public_profile')::boolean = true
  );

-- Grant permissions to authenticated users
GRANT ALL PRIVILEGES ON user_profiles TO authenticated;
GRANT SELECT ON user_profiles TO anon;

-- Create function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create user profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE user_profiles IS 'Extended user profile information';
COMMENT ON COLUMN user_profiles.id IS 'References auth.users.id';
COMMENT ON COLUMN user_profiles.email IS 'User email address';
COMMENT ON COLUMN user_profiles.full_name IS 'User full name';
COMMENT ON COLUMN user_profiles.avatar_url IS 'URL to user avatar image';
COMMENT ON COLUMN user_profiles.bio IS 'User biography/description';
COMMENT ON COLUMN user_profiles.location IS 'User location';
COMMENT ON COLUMN user_profiles.website IS 'User website URL';
COMMENT ON COLUMN user_profiles.phone IS 'User phone number';
COMMENT ON COLUMN user_profiles.birth_date IS 'User birth date';
COMMENT ON COLUMN user_profiles.preferences IS 'User preferences as JSON';
COMMENT ON COLUMN user_profiles.created_at IS 'Profile creation timestamp';
COMMENT ON COLUMN user_profiles.updated_at IS 'Profile last update timestamp';