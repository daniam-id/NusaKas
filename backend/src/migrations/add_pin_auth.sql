-- Migration: Add PIN authentication columns to users table
-- Run this SQL in Supabase SQL Editor

-- Add pin_hash column for storing bcrypt-hashed PIN
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- Add store_name column if not exists (some users may already have this)
ALTER TABLE users ADD COLUMN IF NOT EXISTS store_name TEXT;

-- Add owner_name column if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS owner_name TEXT;

-- Create index for faster lookups by wa_number
CREATE INDEX IF NOT EXISTS idx_users_wa_number ON users(wa_number);

-- Comment: pin_hash will be NULL for new users until they complete registration
-- Comment: Users with pin_hash != NULL are considered "registered" and can login with PIN
