import jwt from 'jsonwebtoken';
import { getSupabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { sessionManager } from './session-manager.js';
import type {
  User,
  RegistrationSession,
  RegistrationCollectedData,
  RegistrationMethod,
  JwtPayload,
} from '../types/index.js';

const JWT_EXPIRY = '7d';

interface CompletionResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

interface ActivationResult {
  success: boolean;
  activated: boolean;
  error?: string;
}

class RegistrationCompletionHandler {
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

  async completeFromSession(sessionId: string): Promise<CompletionResult> {
    const session = await sessionManager.getSession(sessionId);

    if (!session) {
      return { success: false, error: 'Sesi pendaftaran tidak ditemukan' };
    }

    if (session.status === 'completed') {
      return { success: false, error: 'Pendaftaran sudah selesai sebelumnya' };
    }

    if (session.status === 'expired') {
      return { success: false, error: 'Sesi pendaftaran sudah expired' };
    }

    const validation = this.validateCollectedData(session.collected_data);
    if (!validation.valid) {
      return {
        success: false,
        error: `Data belum lengkap: ${validation.errors.join(', ')}`,
      };
    }

    const result = await sessionManager.completeSession(sessionId);

    if (!result.success) {
      return {
        success: false,
        error: result.error_message || 'Gagal menyelesaikan pendaftaran',
      };
    }

    const user = await this.getUserById(result.user_id!);
    if (!user) {
      return { success: false, error: 'Gagal mengambil data user' };
    }

    await this.activateAccount(user.id);

    const token = this.generateToken(user);

    return { success: true, user, token };
  }

  async completeFromPhone(
    waNumber: string,
    data: RegistrationCollectedData,
    method: RegistrationMethod = 'whatsapp'
  ): Promise<CompletionResult> {
    const normalizedNumber = this.normalizePhoneNumber(waNumber);

    const validation = this.validateCollectedData(data);
    if (!validation.valid) {
      return {
        success: false,
        error: `Data tidak valid: ${validation.errors.join(', ')}`,
      };
    }

    const existingUser = await this.getUserByPhone(normalizedNumber);

    if (existingUser?.registration_completed_at) {
      return { success: false, error: 'Nomor ini sudah terdaftar' };
    }

    let session = await sessionManager.getSessionByPhone(normalizedNumber);
    
    if (!session) {
      const { session_id } = await sessionManager.getOrCreateSession(normalizedNumber, method);
      session = await sessionManager.getSession(session_id);
    }

    if (!session) {
      return { success: false, error: 'Gagal membuat sesi pendaftaran' };
    }

    await sessionManager.updateSessionData(session.id, data);
    await sessionManager.updateProgress(session.id, 'completed');

    return this.completeFromSession(session.id);
  }

  async completeWithDirectData(
    waNumber: string,
    storeName: string,
    ownerName: string,
    pinHash: string,
    method: RegistrationMethod = 'whatsapp'
  ): Promise<CompletionResult> {
    const normalizedNumber = this.normalizePhoneNumber(waNumber);
    const supabase = getSupabase();

    const existingUser = await this.getUserByPhone(normalizedNumber);

    let user: User;

    if (existingUser) {
      const { data, error } = await supabase
        .from('users')
        .update({
          store_name: storeName,
          owner_name: ownerName,
          full_name: ownerName,
          pin_hash: pinHash,
          registration_method: method,
          registration_completed_at: new Date().toISOString(),
          onboarding_complete: true,
          is_onboarded: true,
        })
        .eq('id', existingUser.id)
        .select()
        .single();

      if (error || !data) {
        return { success: false, error: 'Gagal update data user' };
      }
      user = data as User;
    } else {
      const { data, error } = await supabase
        .from('users')
        .insert({
          wa_number: normalizedNumber,
          email: `${normalizedNumber}@wa.nusakas.local`,
          store_name: storeName,
          owner_name: ownerName,
          full_name: ownerName,
          pin_hash: pinHash,
          registration_method: method,
          registration_completed_at: new Date().toISOString(),
          onboarding_complete: true,
          is_onboarded: true,
        })
        .select()
        .single();

      if (error || !data) {
        return { success: false, error: 'Gagal membuat user baru' };
      }
      user = data as User;
    }

    const token = this.generateToken(user);
    return { success: true, user, token };
  }

  validateCollectedData(data: RegistrationCollectedData): ValidationResult {
    const errors: string[] = [];

    if (!data.store_name || data.store_name.trim().length < 3) {
      errors.push('Nama toko minimal 3 karakter');
    }

    if (!data.owner_name || data.owner_name.trim().length < 2) {
      errors.push('Nama pemilik minimal 2 karakter');
    }

    if (!data.pin_hash) {
      errors.push('PIN belum diset');
    }

    return { valid: errors.length === 0, errors };
  }

  async activateAccount(userId: string): Promise<ActivationResult> {
    const supabase = getSupabase();

    const { error } = await supabase
      .from('users')
      .update({
        is_active: true,
        onboarding_complete: true,
        is_onboarded: true,
      })
      .eq('id', userId);

    if (error) {
      return { success: false, activated: false, error: error.message };
    }

    return { success: true, activated: true };
  }

  async deactivateAccount(userId: string): Promise<ActivationResult> {
    const supabase = getSupabase();

    const { error } = await supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', userId);

    if (error) {
      return { success: false, activated: true, error: error.message };
    }

    return { success: true, activated: false };
  }

  generateToken(user: User): string {
    const payload: JwtPayload = {
      userId: user.id,
      waNumber: user.wa_number,
    };

    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: JWT_EXPIRY });
  }

  generateRegistrationToken(waNumber: string, sessionId: string): string {
    return jwt.sign(
      { waNumber, sessionId, purpose: 'registration' },
      env.JWT_SECRET,
      { expiresIn: '30m' }
    );
  }

  verifyRegistrationToken(token: string): {
    valid: boolean;
    waNumber?: string;
    sessionId?: string;
  } {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as {
        waNumber: string;
        sessionId: string;
        purpose: string;
      };

      if (payload.purpose !== 'registration') {
        return { valid: false };
      }

      return {
        valid: true,
        waNumber: payload.waNumber,
        sessionId: payload.sessionId,
      };
    } catch {
      return { valid: false };
    }
  }

  async getCompletionStatus(waNumber: string): Promise<{
    isComplete: boolean;
    hasUser: boolean;
    hasSession: boolean;
    missingFields: string[];
    canComplete: boolean;
  }> {
    const normalizedNumber = this.normalizePhoneNumber(waNumber);

    const user = await this.getUserByPhone(normalizedNumber);
    const session = await sessionManager.getSessionByPhone(normalizedNumber);

    const isComplete = !!user?.registration_completed_at;
    const hasUser = !!user;
    const hasSession = !!session;

    const missingFields: string[] = [];
    const data = session?.collected_data || {};

    if (!data.store_name) missingFields.push('store_name');
    if (!data.owner_name) missingFields.push('owner_name');
    if (!data.pin_hash) missingFields.push('pin_hash');

    const canComplete = missingFields.length === 0 && !isComplete;

    return {
      isComplete,
      hasUser,
      hasSession,
      missingFields,
      canComplete,
    };
  }

  async resumeIncompleteRegistration(waNumber: string): Promise<{
    session: RegistrationSession | null;
    nextField: keyof RegistrationCollectedData | null;
    progress: number;
  }> {
    const normalizedNumber = this.normalizePhoneNumber(waNumber);
    const session = await sessionManager.getSessionByPhone(normalizedNumber);

    if (!session) {
      return { session: null, nextField: 'store_name', progress: 0 };
    }

    const nextField = await sessionManager.getNextMissingField(session.id);
    const data = session.collected_data;
    const completedCount = [data.store_name, data.owner_name, data.pin_hash].filter(Boolean).length;
    const progress = Math.round((completedCount / 3) * 100);

    return { session, nextField, progress };
  }

  async cleanupIncompleteRegistration(waNumber: string): Promise<boolean> {
    const normalizedNumber = this.normalizePhoneNumber(waNumber);
    const session = await sessionManager.getSessionByPhone(normalizedNumber);

    if (!session) {
      return false;
    }

    return sessionManager.expireSession(session.id);
  }

  private async getUserById(userId: string): Promise<User | null> {
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

  private async getUserByPhone(waNumber: string): Promise<User | null> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('wa_number', waNumber)
      .single();

    if (error || !data) {
      return null;
    }

    return data as User;
  }
}

export const registrationCompletionHandler = new RegistrationCompletionHandler();
