import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { getSupabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import type { User, OtpCode, JwtPayload } from '../types/index.js';

const OTP_EXPIRY_MINUTES = 5;
const JWT_EXPIRY = '7d';
const BCRYPT_ROUNDS = 10;

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

  async checkUserRegistration(waNumber: string): Promise<{ isRegistered: boolean; user?: User }> {
    const supabase = getSupabase();
    const normalizedNumber = this.normalizePhoneNumber(waNumber);

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('wa_number', normalizedNumber)
      .single();

    if (error || !data) {
      return { isRegistered: false };
    }

    const user = data as User;
    // User is "registered" if they have a PIN set
    const isRegistered = !!user.pin_hash;
    return { isRegistered, user };
  }

  async loginWithPin(waNumber: string, pin: string): Promise<{ valid: boolean; user?: User; token?: string; error?: string }> {
    const supabase = getSupabase();
    const normalizedNumber = this.normalizePhoneNumber(waNumber);

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('wa_number', normalizedNumber)
      .single();

    if (error || !data) {
      return { valid: false, error: 'User not found' };
    }

    const user = data as User;

    if (!user.pin_hash) {
      return { valid: false, error: 'PIN not set. Please register first.' };
    }

    const isMatch = await bcrypt.compare(pin, user.pin_hash);
    if (!isMatch) {
      return { valid: false, error: 'Invalid PIN' };
    }

    const token = this.generateToken(user);
    return { valid: true, user, token };
  }

  async completeRegistration(
    waNumber: string, 
    storeName: string, 
    pin: string,
    ownerName?: string
  ): Promise<{ success: boolean; user?: User; token?: string; error?: string }> {
    const supabase = getSupabase();
    const normalizedNumber = this.normalizePhoneNumber(waNumber);

    // Validate PIN format (4-6 digits)
    if (!/^\d{4,6}$/.test(pin)) {
      return { success: false, error: 'PIN must be 4-6 digits' };
    }

    // Hash the PIN
    const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS);

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('wa_number', normalizedNumber)
      .single();

    let user: User;

    if (existingUser) {
      // Update existing user
      const { data: updatedUser, error } = await supabase
        .from('users')
        .update({
          store_name: storeName,
          pin_hash: pinHash,
          owner_name: ownerName || existingUser.owner_name,
        })
        .eq('wa_number', normalizedNumber)
        .select()
        .single();

      if (error || !updatedUser) {
        return { success: false, error: 'Failed to update user' };
      }
      user = updatedUser as User;
    } else {
      // Create new user with PIN
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          wa_number: normalizedNumber,
          email: `${normalizedNumber}@wa.nusakas.local`,
          store_name: storeName,
          pin_hash: pinHash,
          owner_name: ownerName || 'Juragan',
          full_name: ownerName || 'Juragan',
        })
        .select()
        .single();

      if (error || !newUser) {
        return { success: false, error: 'Failed to create user' };
      }
      user = newUser as User;
    }

    const token = this.generateToken(user);
    return { success: true, user, token };
  }

  async verifyOtpForRegistration(waNumber: string, code: string): Promise<{ valid: boolean; tempToken?: string }> {
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

    // Generate temporary token for registration completion
    const tempToken = jwt.sign(
      { waNumber: normalizedNumber, purpose: 'registration' },
      env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    return { valid: true, tempToken };
  }

  verifyRegistrationToken(tempToken: string): { valid: boolean; waNumber?: string } {
    try {
      const payload = jwt.verify(tempToken, env.JWT_SECRET) as { waNumber: string; purpose: string };
      if (payload.purpose !== 'registration') {
        return { valid: false };
      }
      return { valid: true, waNumber: payload.waNumber };
    } catch {
      return { valid: false };
    }
  }
}

export const authService = new AuthService();
