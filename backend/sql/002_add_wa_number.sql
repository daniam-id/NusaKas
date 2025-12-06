-- Add wa_number column to existing users table
-- Run this in Supabase SQL Editor

-- Add wa_number column if it doesn't exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS wa_number TEXT UNIQUE;

-- Add full_name column if it doesn't exist (maps to owner_name)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS full_name TEXT DEFAULT 'Juragan';

-- Update wa_number from admin_wa for existing users
UPDATE public.users 
SET wa_number = admin_wa 
WHERE wa_number IS NULL AND admin_wa IS NOT NULL;

-- Create index on wa_number
CREATE INDEX IF NOT EXISTS idx_users_wa_number ON public.users(wa_number);
