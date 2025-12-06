-- NusaKas Reminder, Verification & Style Customization Migration
-- Run this in Supabase SQL Editor
-- Implements PRD-4 features: reminders, OTP verification, bot style customization

-- 1. Extend users table with personalization columns
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS reminder_time TIME DEFAULT '21:00:00',
  ADD COLUMN IF NOT EXISTS operational_days JSONB DEFAULT '["monday","tuesday","wednesday","thursday","friday","saturday"]'::jsonb,
  ADD COLUMN IF NOT EXISTS bot_style TEXT DEFAULT 'santai',
  ADD COLUMN IF NOT EXISTS use_emoji BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;

-- 2. Add check constraint for bot_style (drop if exists first)
DO $$
BEGIN
  ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_bot_style_check;
  ALTER TABLE public.users ADD CONSTRAINT users_bot_style_check 
    CHECK (bot_style IN ('formal', 'santai', 'semi-formal'));
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- 3. Create pending_registrations table for web-to-WhatsApp OTP verification
CREATE TABLE IF NOT EXISTS public.pending_registrations (
  wa_number TEXT PRIMARY KEY,
  otp_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes')
);

-- 4. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_pending_registrations_expires 
  ON public.pending_registrations(expires_at);

CREATE INDEX IF NOT EXISTS idx_users_reminder_time 
  ON public.users(reminder_time);

-- 5. Function to cleanup expired pending registrations
CREATE OR REPLACE FUNCTION cleanup_expired_registrations()
RETURNS void AS $$
BEGIN
  DELETE FROM public.pending_registrations WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 6. Function to get users needing reminders at current time
CREATE OR REPLACE FUNCTION get_users_for_reminder(
  p_time TIME,
  p_day TEXT
)
RETURNS TABLE (
  id UUID,
  wa_number TEXT,
  full_name TEXT,
  bot_style TEXT,
  use_emoji BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.wa_number,
    u.full_name,
    u.bot_style,
    u.use_emoji
  FROM public.users u
  WHERE u.reminder_time = p_time
    AND u.operational_days ? p_day
    AND u.onboarding_complete = true;
END;
$$ LANGUAGE plpgsql;
