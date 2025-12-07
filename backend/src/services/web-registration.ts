import crypto from 'crypto';
import { getSupabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { sessionManager } from './session-manager.js';
import type {
  GenerateOTPResponse,
  ValidateOTPResponse,
  OTPPurpose,
  User,
} from '../types/index.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 3;
const BCRYPT_ROUNDS = 10;
const JWT_EXPIRY = '7d';

class WebRegistrationFlow {
  private generateSecureOTP(): string {
    const buffer = crypto.randomBytes(4);
    const num = buffer.readUInt32BE(0) % 1000000;
    return num.toString().padStart(OTP_LENGTH, '0');
  }

  private normalizePhoneNumber(waNumber: string): string {
    let normalized = waNumber.replace(/\D/g, '');
    if (normalized.startsWith('0')) {
      normalized = '62' + normalized.slice(1);
    }
    if (!normalized.startsWith('62')) {
      normalized = '62' + normalized;
    }
    return normalized;
  }

  async generateOTP(
    waNumber: string,
    purpose: OTPPurpose = 'web_verification',
    sessionId?: string
  ): Promise<GenerateOTPResponse> {
    const supabase = getSupabase();
    const normalizedNumber = this.normalizePhoneNumber(waNumber);
    const otpCode = this.generateSecureOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await supabase
      .from('otp_verifications')
      .update({ status: 'expired' })
      .eq('wa_number', normalizedNumber)
      .eq('status', 'pending');

    const { data, error } = await supabase
      .from('otp_verifications')
      .insert({
        wa_number: normalizedNumber,
        otp_code: otpCode,
        purpose,
        source_session: sessionId || null,
        status: 'pending',
        attempts: 0,
        max_attempts: MAX_OTP_ATTEMPTS,
        expires_at: expiresAt.toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to generate OTP: ${error.message}`);
    }

    const verificationLink = this.buildVerificationLink(normalizedNumber, otpCode);

    return {
      otp_id: data.id,
      otp_code: otpCode,
      expires_at: expiresAt.toISOString(),
      verification_link: verificationLink,
    };
  }

  async validateOTP(waNumber: string, otpCode: string): Promise<ValidateOTPResponse> {
    const supabase = getSupabase();
    const normalizedNumber = this.normalizePhoneNumber(waNumber);

    const { data, error } = await supabase.rpc('validate_otp', {
      p_wa_number: normalizedNumber,
      p_otp_code: otpCode,
    });

    if (error) {
      return {
        is_valid: false,
        otp_id: null,
        session_id: null,
        error_message: error.message,
      };
    }

    const result = data[0];
    return {
      is_valid: result.is_valid,
      otp_id: result.otp_id,
      session_id: result.session_id,
      error_message: result.error_message,
    };
  }

  async startWebRegistration(waNumber: string): Promise<{
    success: boolean;
    otp: GenerateOTPResponse | null;
    error?: string;
  }> {
    const normalizedNumber = this.normalizePhoneNumber(waNumber);

    try {
      const { session_id } = await sessionManager.getOrCreateSession(normalizedNumber, 'web');
      await sessionManager.updateProgress(session_id, 'verification');

      const otp = await this.generateOTP(normalizedNumber, 'web_verification', session_id);

      return { success: true, otp };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, otp: null, error: message };
    }
  }

  async verifyAndCreateSession(
    waNumber: string,
    otpCode: string
  ): Promise<{
    success: boolean;
    session_id?: string;
    error?: string;
  }> {
    const validation = await this.validateOTP(waNumber, otpCode);

    if (!validation.is_valid) {
      return {
        success: false,
        error: validation.error_message || 'Invalid OTP',
      };
    }

    if (validation.session_id) {
      return {
        success: true,
        session_id: validation.session_id,
      };
    }

    const normalizedNumber = this.normalizePhoneNumber(waNumber);
    const { session_id } = await sessionManager.getOrCreateSession(normalizedNumber, 'web');
    await sessionManager.updateProgress(session_id, 'data_collection');

    return {
      success: true,
      session_id,
    };
  }

  async completeWebRegistration(
    sessionId: string,
    data: {
      store_name: string;
      owner_name: string;
      pin: string;
    }
  ): Promise<{
    success: boolean;
    user?: User;
    token?: string;
    error?: string;
  }> {
    try {
      const pinHash = await bcrypt.hash(data.pin, BCRYPT_ROUNDS);

      await sessionManager.updateSessionData(sessionId, {
        store_name: data.store_name,
        owner_name: data.owner_name,
        pin_hash: pinHash,
      });

      const result = await sessionManager.completeSession(sessionId);

      if (!result.success) {
        return {
          success: false,
          error: result.error_message || 'Failed to complete registration',
        };
      }

      const supabase = getSupabase();
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', result.user_id)
        .single();

      if (userError || !userData) {
        return {
          success: false,
          error: 'Failed to retrieve user data',
        };
      }

      const user = userData as User;
      const token = this.generateToken(user);

      return {
        success: true,
        user,
        token,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  async resendOTP(waNumber: string): Promise<{
    success: boolean;
    otp?: GenerateOTPResponse;
    error?: string;
  }> {
    const normalizedNumber = this.normalizePhoneNumber(waNumber);

    try {
      const session = await sessionManager.getSessionByPhone(normalizedNumber);
      const otp = await this.generateOTP(
        normalizedNumber,
        'web_verification',
        session?.id
      );

      return { success: true, otp };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  async checkOTPStatus(waNumber: string): Promise<{
    hasPending: boolean;
    expiresAt?: string;
    attemptsRemaining?: number;
  }> {
    const supabase = getSupabase();
    const normalizedNumber = this.normalizePhoneNumber(waNumber);

    const { data } = await supabase
      .from('otp_verifications')
      .select('expires_at, attempts, max_attempts')
      .eq('wa_number', normalizedNumber)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!data) {
      return { hasPending: false };
    }

    return {
      hasPending: true,
      expiresAt: data.expires_at,
      attemptsRemaining: data.max_attempts - data.attempts,
    };
  }

  async cleanupExpiredOTPs(): Promise<number> {
    const supabase = getSupabase();

    const { data, error } = await supabase.rpc('cleanup_expired_otp_verifications');

    if (error) {
      console.error('[WebRegistration] Cleanup error:', error.message);
      return 0;
    }

    return data || 0;
  }

  private buildVerificationLink(waNumber: string, otpCode: string): string {
    const baseUrl = env.FRONTEND_URL;
    return `${baseUrl}/verify?otp=${otpCode}&phone=${waNumber}`;
  }

  private generateToken(user: User): string {
    return jwt.sign(
      { userId: user.id, waNumber: user.wa_number },
      env.JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
  }

  async getRegistrationStatus(waNumber: string): Promise<{
    hasUser: boolean;
    hasSession: boolean;
    sessionStep?: string;
    isComplete: boolean;
  }> {
    const supabase = getSupabase();
    const normalizedNumber = this.normalizePhoneNumber(waNumber);

    const { data: userData } = await supabase
      .from('users')
      .select('id, onboarding_complete, registration_completed_at')
      .eq('wa_number', normalizedNumber)
      .single();

    const session = await sessionManager.getSessionByPhone(normalizedNumber);

    return {
      hasUser: !!userData,
      hasSession: !!session,
      sessionStep: session?.current_step,
      isComplete: !!userData?.registration_completed_at,
    };
  }
}

export const webRegistrationFlow = new WebRegistrationFlow();
