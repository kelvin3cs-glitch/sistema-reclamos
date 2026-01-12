import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pdznmhuhblqvcypuiicn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkem5taHVoYmxxdmN5cHVpaWNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk5NjUzMCwiZXhwIjoyMDgzNTcyNTMwfQ.M0Fyx5bxI43QIiDGkBqTVCnr6IMSVyY6LE8btYkC3jQ'

export const supabase = createClient(supabaseUrl, supabaseKey)