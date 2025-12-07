import { getSupabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import type { User, PendingRegistration, VerificationResult } from '../types/index.js';
import jwt from 'jsonwebtoken';

const OTP_LENGTH = 4;
const OTP_EXPIRY_MINUTES = 5;
const JWT_EXPIRY = '7d';

// Pre-filled message template for WhatsApp deep link
const OTP_MESSAGE_TEMPLATE = 'Hi, ini kode OTP saya:';

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
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const { error } = await supabase
      .from('pending_registrations')
      .upsert({
        wa_number: normalizedNumber,
        otp_code: otpCode,
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      }, { onConflict: 'wa_number' });

    if (error) {
      return {
        success: false,
        message: `Gagal memulai verifikasi: ${error.message}`,
      };
    }

    // Build WhatsApp deep link to BOT number (not user's number)
    const botNumber = env.WHATSAPP_BOT_NUMBER.replace(/\D/g, '');
    if (!botNumber) {
      console.warn('[Registration] WHATSAPP_BOT_NUMBER not configured');
      return {
        success: false,
        message: 'Konfigurasi bot WhatsApp belum lengkap. Hubungi admin.',
      };
    }

    // Pre-filled message: "Hi, ini kode OTP saya: [CODE]"
    const message = encodeURIComponent(`${OTP_MESSAGE_TEMPLATE} ${otpCode}`);
    const waLink = `https://wa.me/${botNumber}?text=${message}`;

    return {
      success: true,
      message: 'Kode OTP berhasil dibuat. Klik tombol untuk kirim OTP via WhatsApp.',
      wa_link: waLink,
      otp_code: process.env.NODE_ENV !== 'production' ? otpCode : undefined,
      expires_at: expiresAt.toISOString(),
      wa_number: normalizedNumber,
    };
  }

  /**
   * Verify OTP from incoming WhatsApp message.
   * The sender's WA number is validated against the pending registration.
   */
  async verifyOTP(senderWaNumber: string, otpCode: string): Promise<VerificationResult> {
    const supabase = getSupabase();
    const normalizedSender = this.normalizePhoneNumber(senderWaNumber);

    // Look up pending registration by OTP code first
    const { data: pendingData, error: pendingError } = await supabase
      .from('pending_registrations')
      .select('*')
      .eq('otp_code', otpCode)
      .single();

    if (pendingError || !pendingData) {
      return {
        success: false,
        message: 'Kode OTP tidak ditemukan atau sudah digunakan.',
      };
    }

    const pending = pendingData as PendingRegistration;
    const isExpired = new Date(pending.expires_at) < new Date();

    if (isExpired) {
      await supabase.from('pending_registrations').delete().eq('wa_number', pending.wa_number);
      return {
        success: false,
        message: 'Kode OTP sudah kedaluwarsa. Silakan minta kode baru dari aplikasi.',
      };
    }

    // Validate sender matches the registered number
    if (pending.wa_number !== normalizedSender) {
      return {
        success: false,
        message: 'Nomor pengirim tidak sesuai dengan nomor yang didaftarkan.',
      };
    }

    // OTP valid - delete and create/get user
    await supabase.from('pending_registrations').delete().eq('wa_number', normalizedSender);

    const user = await this.getOrCreateUser(normalizedSender);
    const token = this.generateToken(user);

    return {
      success: true,
      message: 'Verifikasi berhasil! Selamat datang di NusaKas.',
      user,
      token,
      wa_number: normalizedSender,
    };
  }

  /**
   * Check verification status (polling from frontend)
   */
  async checkVerificationStatus(waNumber: string): Promise<VerificationResult> {
    const supabase = getSupabase();
    const normalizedNumber = this.normalizePhoneNumber(waNumber);

    // Check if user is now verified (has a record in users table)
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('wa_number', normalizedNumber)
      .single();

    if (userData) {
      const user = userData as User;
      const token = this.generateToken(user);
      return {
        success: true,
        message: 'User sudah terverifikasi.',
        user,
        token,
        wa_number: normalizedNumber,
      };
    }

    // Check if pending registration still exists
    const { data: pendingData } = await supabase
      .from('pending_registrations')
      .select('expires_at')
      .eq('wa_number', normalizedNumber)
      .single();

    if (pendingData) {
      const isExpired = new Date(pendingData.expires_at) < new Date();
      if (isExpired) {
        return {
          success: false,
          message: 'Kode OTP sudah kedaluwarsa. Silakan minta kode baru.',
        };
      }
      return {
        success: false,
        message: 'Menunggu verifikasi OTP via WhatsApp.',
      };
    }

    return {
      success: false,
      message: 'Tidak ada permintaan verifikasi. Silakan daftar ulang.',
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
