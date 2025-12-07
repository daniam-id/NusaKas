-- NusaKas Registration Flow Tables Migration
-- Implements multi-platform registration with session management and OTP verification
-- Run this in Supabase SQL Editor

-- Enable UUID extension (ensure available)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Table: registration_sessions
-- Tracks registration progress across platforms (WhatsApp, Web, Hybrid)
CREATE TABLE IF NOT EXISTS public.registration_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  wa_number TEXT NOT NULL,
  source_platform TEXT NOT NULL CHECK (source_platform IN ('whatsapp', 'web', 'hybrid')),
  current_step TEXT NOT NULL DEFAULT 'options' CHECK (current_step IN ('options', 'data_collection', 'verification', 'completed')),
  collected_data JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 minutes')
);

-- Unique constraint: one active session per phone number
CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_sessions_active_wa 
  ON public.registration_sessions(wa_number) 
  WHERE status IN ('pending', 'active');

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_registration_sessions_wa_number 
  ON public.registration_sessions(wa_number);
CREATE INDEX IF NOT EXISTS idx_registration_sessions_status 
  ON public.registration_sessions(status);
CREATE INDEX IF NOT EXISTS idx_registration_sessions_expires 
  ON public.registration_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_registration_sessions_created 
  ON public.registration_sessions(created_at);

-- 2. Table: otp_verifications
-- Secure OTP tracking with single-use enforcement
CREATE TABLE IF NOT EXISTS public.otp_verifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  wa_number TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('web_verification', 'whatsapp_verification', 'hybrid_link')),
  source_session UUID REFERENCES public.registration_sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'expired')),
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 minutes'),
  used_at TIMESTAMPTZ
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_otp_verifications_wa_number 
  ON public.otp_verifications(wa_number);
CREATE INDEX IF NOT EXISTS idx_otp_verifications_code 
  ON public.otp_verifications(otp_code);
CREATE INDEX IF NOT EXISTS idx_otp_verifications_status 
  ON public.otp_verifications(status);
CREATE INDEX IF NOT EXISTS idx_otp_verifications_expires 
  ON public.otp_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_verifications_session 
  ON public.otp_verifications(source_session);

-- Composite index for OTP lookup (phone + code + pending status)
CREATE INDEX IF NOT EXISTS idx_otp_verifications_lookup 
  ON public.otp_verifications(wa_number, otp_code) 
  WHERE status = 'pending';

-- 3. Extend users table with registration tracking
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS registration_method TEXT CHECK (registration_method IN ('whatsapp', 'web', 'hybrid')),
  ADD COLUMN IF NOT EXISTS registration_completed_at TIMESTAMPTZ;

-- Index for registration analytics
CREATE INDEX IF NOT EXISTS idx_users_registration_method 
  ON public.users(registration_method);

-- 4. Function: Auto-update updated_at on registration_sessions
CREATE OR REPLACE FUNCTION update_registration_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_registration_session_timestamp ON public.registration_sessions;
CREATE TRIGGER trg_update_registration_session_timestamp
  BEFORE UPDATE ON public.registration_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_registration_session_timestamp();

-- 5. Function: Cleanup expired registration sessions
CREATE OR REPLACE FUNCTION cleanup_expired_registration_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM public.registration_sessions 
    WHERE expires_at < NOW() 
      AND status IN ('pending', 'active')
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 6. Function: Cleanup expired OTP verifications  
CREATE OR REPLACE FUNCTION cleanup_expired_otp_verifications()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE public.otp_verifications 
    SET status = 'expired'
    WHERE expires_at < NOW() 
      AND status = 'pending'
    RETURNING id
  )
  SELECT COUNT(*) INTO updated_count FROM updated;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- 7. Function: Validate OTP with single-use enforcement
CREATE OR REPLACE FUNCTION validate_otp(
  p_wa_number TEXT,
  p_otp_code TEXT
)
RETURNS TABLE (
  is_valid BOOLEAN,
  otp_id UUID,
  session_id UUID,
  error_message TEXT
) AS $$
DECLARE
  v_otp_record RECORD;
BEGIN
  -- Find pending OTP for this phone number and code
  SELECT o.id, o.source_session, o.attempts, o.max_attempts, o.expires_at
  INTO v_otp_record
  FROM public.otp_verifications o
  WHERE o.wa_number = p_wa_number 
    AND o.otp_code = p_otp_code
    AND o.status = 'pending'
  ORDER BY o.created_at DESC
  LIMIT 1;
  
  -- No matching OTP found
  IF v_otp_record IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, 'Kode OTP tidak valid';
    RETURN;
  END IF;
  
  -- Check if expired
  IF v_otp_record.expires_at < NOW() THEN
    UPDATE public.otp_verifications SET status = 'expired' WHERE id = v_otp_record.id;
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, 'Kode OTP sudah expired';
    RETURN;
  END IF;
  
  -- Check max attempts
  IF v_otp_record.attempts >= v_otp_record.max_attempts THEN
    UPDATE public.otp_verifications SET status = 'expired' WHERE id = v_otp_record.id;
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, 'Terlalu banyak percobaan, silakan minta OTP baru';
    RETURN;
  END IF;
  
  -- Mark OTP as used
  UPDATE public.otp_verifications 
  SET status = 'used', 
      used_at = NOW(),
      attempts = attempts + 1
  WHERE id = v_otp_record.id;
  
  -- Return success
  RETURN QUERY SELECT true, v_otp_record.id, v_otp_record.source_session, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 8. Function: Get or create registration session
CREATE OR REPLACE FUNCTION get_or_create_registration_session(
  p_wa_number TEXT,
  p_source_platform TEXT DEFAULT 'whatsapp'
)
RETURNS TABLE (
  session_id UUID,
  is_new BOOLEAN,
  current_step TEXT,
  collected_data JSONB
) AS $$
DECLARE
  v_session RECORD;
BEGIN
  -- Find existing active session
  SELECT rs.id, rs.current_step, rs.collected_data
  INTO v_session
  FROM public.registration_sessions rs
  WHERE rs.wa_number = p_wa_number 
    AND rs.status IN ('pending', 'active')
    AND rs.expires_at > NOW()
  LIMIT 1;
  
  IF v_session IS NOT NULL THEN
    -- Update existing session
    UPDATE public.registration_sessions 
    SET expires_at = NOW() + INTERVAL '30 minutes'
    WHERE id = v_session.id;
    
    RETURN QUERY SELECT v_session.id, false, v_session.current_step, v_session.collected_data;
    RETURN;
  END IF;
  
  -- Create new session
  INSERT INTO public.registration_sessions (wa_number, source_platform, status)
  VALUES (p_wa_number, p_source_platform, 'active')
  RETURNING registration_sessions.id, registration_sessions.current_step, registration_sessions.collected_data
  INTO v_session;
  
  RETURN QUERY SELECT v_session.id, true, v_session.current_step, v_session.collected_data;
END;
$$ LANGUAGE plpgsql;

-- 9. Function: Update registration session progress
CREATE OR REPLACE FUNCTION update_registration_progress(
  p_session_id UUID,
  p_step TEXT DEFAULT NULL,
  p_data JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.registration_sessions 
  SET 
    current_step = COALESCE(p_step, current_step),
    collected_data = CASE 
      WHEN p_data IS NOT NULL THEN collected_data || p_data 
      ELSE collected_data 
    END,
    expires_at = NOW() + INTERVAL '30 minutes'
  WHERE id = p_session_id
    AND status IN ('pending', 'active');
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 10. Function: Complete registration and create user
CREATE OR REPLACE FUNCTION complete_registration(
  p_session_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  user_id UUID,
  error_message TEXT
) AS $$
DECLARE
  v_session RECORD;
  v_user_id UUID;
  v_wa_number TEXT;
BEGIN
  -- Get session data
  SELECT rs.wa_number, rs.source_platform, rs.collected_data
  INTO v_session
  FROM public.registration_sessions rs
  WHERE rs.id = p_session_id 
    AND rs.status = 'active';
  
  IF v_session IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Sesi registrasi tidak ditemukan atau sudah expired';
    RETURN;
  END IF;
  
  v_wa_number := v_session.wa_number;
  
  -- Check if user already exists
  SELECT u.id INTO v_user_id
  FROM public.users u
  WHERE u.wa_number = v_wa_number;
  
  IF v_user_id IS NOT NULL THEN
    -- Update existing user
    UPDATE public.users SET
      store_name = COALESCE((v_session.collected_data->>'store_name')::TEXT, store_name),
      owner_name = COALESCE((v_session.collected_data->>'owner_name')::TEXT, owner_name),
      full_name = COALESCE((v_session.collected_data->>'owner_name')::TEXT, full_name),
      pin_hash = COALESCE((v_session.collected_data->>'pin_hash')::TEXT, pin_hash),
      registration_method = v_session.source_platform,
      registration_completed_at = NOW(),
      onboarding_complete = true,
      is_onboarded = true,
      updated_at = NOW()
    WHERE id = v_user_id;
  ELSE
    -- Create new user
    INSERT INTO public.users (
      wa_number,
      store_name,
      owner_name,
      full_name,
      pin_hash,
      registration_method,
      registration_completed_at,
      onboarding_complete,
      is_onboarded
    ) VALUES (
      v_wa_number,
      (v_session.collected_data->>'store_name')::TEXT,
      (v_session.collected_data->>'owner_name')::TEXT,
      COALESCE((v_session.collected_data->>'owner_name')::TEXT, 'Juragan'),
      (v_session.collected_data->>'pin_hash')::TEXT,
      v_session.source_platform,
      NOW(),
      true,
      true
    )
    RETURNING id INTO v_user_id;
  END IF;
  
  -- Mark session as completed
  UPDATE public.registration_sessions 
  SET status = 'completed', current_step = 'completed'
  WHERE id = p_session_id;
  
  RETURN QUERY SELECT true, v_user_id, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 11. Enable RLS on new tables
ALTER TABLE public.registration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

-- 12. RLS Policies (service role bypass)
DROP POLICY IF EXISTS "Service role full access to registration_sessions" ON public.registration_sessions;
CREATE POLICY "Service role full access to registration_sessions" 
  ON public.registration_sessions 
  FOR ALL 
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to otp_verifications" ON public.otp_verifications;
CREATE POLICY "Service role full access to otp_verifications" 
  ON public.otp_verifications 
  FOR ALL 
  USING (auth.role() = 'service_role');
