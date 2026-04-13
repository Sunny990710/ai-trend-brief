import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[Supabase] SUPABASE_URL and SUPABASE_KEY must be set in environment variables');
}

export const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '');
