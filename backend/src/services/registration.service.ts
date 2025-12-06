import { getSupabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import type { User, PendingRegistration, VerificationResult } from '../types/index.js';
import jwt from 'jsonwebtoken';

const OTP_LENGTH = 4;
const OTP_EXPIRY_MINUTES = 10;
const JWT_EXPIRY = '7d';

export class RegistrationService {
  private generateOtp(): string {
    return Math.floor(1000 + Math.random() * 9000).toString().slice(0, OTP_LENGTH);
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

  async startVerification(waNumber: string): Promise<VerificationResult> {
    const supabase = getSupabase();
    const normalizedNumber = this.normalizePhoneNumber(waNumber);
    const otpCode = this.generateOtp();

    const { error } = await supabase
      .from('pending_registrations')
      .upsert({
        wa_number: normalizedNumber,
        otp_code: otpCode,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString(),
      }, { onConflict: 'wa_number' });

    if (error) {
      return {
        success: false,
        message: `Gagal memulai verifikasi: ${error.message}`,
      };
    }

    const waLink = `https://wa.me/${normalizedNumber}?text=VERIFY%20${otpCode}`;

    return {
      success: true,
      message: 'OTP berhasil dibuat. Silakan klik link untuk verifikasi via WhatsApp.',
      wa_link: waLink,
    };
  }

  async verifyOTP(waNumber: string, otpCode: string): Promise<VerificationResult> {
    const supabase = getSupabase();
    const normalizedNumber = this.normalizePhoneNumber(waNumber);

    const { data: pendingData, error: pendingError } = await supabase
      .from('pending_registrations')
      .select('*')
      .eq('wa_number', normalizedNumber)
      .single();

    if (pendingError || !pendingData) {
      return {
        success: false,
        message: 'Tidak ada permintaan verifikasi untuk nomor ini. Silakan daftar ulang.',
      };
    }

    const pending = pendingData as PendingRegistration;
    const isExpired = new Date(pending.expires_at) < new Date();

    if (isExpired) {
      await supabase.from('pending_registrations').delete().eq('wa_number', normalizedNumber);
      return {
        success: false,
        message: 'Kode OTP sudah kedaluwarsa. Silakan minta kode baru.',
      };
    }

    if (pending.otp_code !== otpCode) {
      return {
        success: false,
        message: 'Kode OTP tidak valid. Silakan coba lagi.',
      };
    }

    await supabase.from('pending_registrations').delete().eq('wa_number', normalizedNumber);

    const user = await this.getOrCreateUser(normalizedNumber);
    const token = this.generateToken(user);

    return {
      success: true,
      message: 'Verifikasi berhasil! Selamat datang di NusaKas.',
      user,
      token,
    };
  }

  private async getOrCreateUser(waNumber: string): Promise<User> {
    const supabase = getSupabase();

    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('wa_number', waNumber)
      .single();

    if (existingUser) {
      return existingUser as User;
    }

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        wa_number: waNumber,
        full_name: 'Juragan',
        onboarding_complete: false,
      })
      .select()
      .single();

    if (error || !newUser) {
      throw new Error(`Gagal membuat user: ${error?.message}`);
    }

    return newUser as User;
  }

  private generateToken(user: User): string {
    return jwt.sign(
      { userId: user.id, waNumber: user.wa_number },
      env.JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
  }

  async cleanupExpiredRegistrations(): Promise<number> {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('pending_registrations')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select();

    if (error) {
      console.error('Cleanup error:', error.message);
      return 0;
    }

    return data?.length || 0;
  }
}

export const registrationService = new RegistrationService();
