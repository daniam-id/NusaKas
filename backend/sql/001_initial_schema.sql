-- NusaKas Initial Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Table: users (Custom auth, bypassing Supabase Auth)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  wa_number TEXT UNIQUE NOT NULL,
  full_name TEXT DEFAULT 'Juragan',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table: otp_codes (for WhatsApp OTP verification)
CREATE TABLE IF NOT EXISTS public.otp_codes (
  wa_number TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

-- 3. Table: transactions (financial records)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  daily_id INT,
  type TEXT CHECK (type IN ('INCOME', 'EXPENSE')) NOT NULL,
  category TEXT DEFAULT 'Lainnya',
  amount NUMERIC NOT NULL,
  description TEXT,
  transaction_date DATE DEFAULT CURRENT_DATE,
  proof_image_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON public.otp_codes(expires_at);

-- Function to auto-generate daily_id (resets per user per day)
CREATE OR REPLACE FUNCTION generate_daily_id()
RETURNS TRIGGER AS $$
DECLARE
  max_daily_id INT;
BEGIN
  SELECT COALESCE(MAX(daily_id), 0) INTO max_daily_id
  FROM public.transactions
  WHERE user_id = NEW.user_id 
    AND transaction_date = NEW.transaction_date;
  
  NEW.daily_id := max_daily_id + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-assign daily_id
DROP TRIGGER IF EXISTS trg_generate_daily_id ON public.transactions;
CREATE TRIGGER trg_generate_daily_id
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION generate_daily_id();

-- Cleanup function for expired OTPs (can be called periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM public.otp_codes WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
