import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://awbtxhwifbmazdcywgnj.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YnR4aHdpZmJtYXpkY3l3Z25qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5Njk3MTcsImV4cCI6MjA3MzU0NTcxN30.CvdrUHsO_rhszsvsNav9ReyMK5D__PivRVEQc0kuFdI'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export { supabaseUrl, supabaseAnonKey }