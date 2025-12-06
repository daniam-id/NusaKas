import jwt from 'jsonwebtoken';
import { getSupabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import type { User, OtpCode, JwtPayload } from '../types/index.js';

const OTP_EXPIRY_MINUTES = 5;
const JWT_EXPIRY = '7d';

export class AuthService {
  private generateOtp(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
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

  async createOtp(waNumber: string): Promise<{ code: string; expiresAt: Date }> {
    const supabase = getSupabase();
    const normalizedNumber = this.normalizePhoneNumber(waNumber);
    const code = this.generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const { error } = await supabase
      .from('otp_codes')
      .upsert({
        wa_number: normalizedNumber,
        code,
        expires_at: expiresAt.toISOString(),
      }, { onConflict: 'wa_number' });

    if (error) {
      throw new Error(`Failed to create OTP: ${error.message}`);
    }

    return { code, expiresAt };
  }

  async verifyOtp(waNumber: string, code: string): Promise<{ valid: boolean; user?: User; token?: string }> {
    const supabase = getSupabase();
    const normalizedNumber = this.normalizePhoneNumber(waNumber);

    const { data: otpData, error: otpError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('wa_number', normalizedNumber)
      .single();

    if (otpError || !otpData) {
      return { valid: false };
    }

    const otpRecord = otpData as OtpCode;
    const isExpired = new Date(otpRecord.expires_at) < new Date();
    const isCodeValid = otpRecord.code === code;

    if (!isCodeValid || isExpired) {
      return { valid: false };
    }

    // Delete used OTP
    await supabase.from('otp_codes').delete().eq('wa_number', normalizedNumber);

    // Get or create user
    const user = await this.getOrCreateUser(normalizedNumber);
    const token = this.generateToken(user);

    return { valid: true, user, token };
  }

  async getOrCreateUser(waNumber: string): Promise<User> {
    const supabase = getSupabase();
    const normalizedNumber = this.normalizePhoneNumber(waNumber);

    // Try to find existing user
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('wa_number', normalizedNumber)
      .single();

    if (existingUser) {
      return existingUser as User;
    }

    // Create new user with placeholder values for WhatsApp-only auth
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({ 
        wa_number: normalizedNumber,
        email: `${normalizedNumber}@wa.nusakas.local`,
        owner_name: 'Juragan',
        store_name: 'Toko Baru',
      })
      .select()
      .single();

    if (error || !newUser) {
      throw new Error(`Failed to create user: ${error?.message}`);
    }

    return newUser as User;
  }

  generateToken(user: User): string {
    const payload: JwtPayload = {
      userId: user.id,
      waNumber: user.wa_number,
    };

    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: JWT_EXPIRY });
  }

  verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    } catch {
      throw new Error('Invalid or expired token');
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as User;
  }
}

export const authService = new AuthService();
