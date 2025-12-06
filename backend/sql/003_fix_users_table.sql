-- Fix users table to make email nullable (WhatsApp-first auth)
-- Run this in Supabase SQL Editor

-- Make email nullable
ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;

-- Ensure wa_number is unique (if not already)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_wa_number_key'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_wa_number_key UNIQUE (wa_number);
  END IF;
END $$;

-- Add index on wa_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_wa_number ON public.users(wa_number);
