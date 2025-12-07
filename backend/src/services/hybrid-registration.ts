import { getSupabase } from '../config/supabase.js';
import { sessionManager } from './session-manager.js';
import { webRegistrationFlow } from './web-registration.js';
import { env } from '../config/env.js';
import type {
  RegistrationSession,
  RegistrationCollectedData,
  GenerateOTPResponse,
  User,
} from '../types/index.js';
import jwt from 'jsonwebtoken';

const JWT_EXPIRY = '7d';

type PlatformSource = 'whatsapp' | 'web';

interface HybridLinkResult {
  success: boolean;
  otp?: GenerateOTPResponse;
  link?: string;
  error?: string;
}

interface PlatformSwitchResult {
  success: boolean;
  session?: RegistrationSession;
  error?: string;
}

interface MergeResult {
  success: boolean;
  mergedData?: RegistrationCollectedData;
  conflicts?: string[];
  error?: string;
}

class HybridRegistrationFlow {
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

  async initiateWebToWhatsApp(waNumber: string): Promise<HybridLinkResult> {
    const normalizedNumber = this.normalizePhoneNumber(waNumber);

    try {
      let session = await sessionManager.getSessionByPhone(normalizedNumber);
      
      if (!session) {
        const { session_id } = await sessionManager.getOrCreateSession(normalizedNumber, 'hybrid');
        session = await sessionManager.getSession(session_id);
      } else {
        await sessionManager.syncFromPlatform(session.id, 'hybrid', {});
      }

      if (!session) {
        return { success: false, error: 'Failed to create session' };
      }

      const otp = await webRegistrationFlow.generateOTP(
        normalizedNumber,
        'hybrid_link',
        session.id
      );

      const whatsappLink = this.buildWhatsAppLink(normalizedNumber, otp.otp_code);

      return {
        success: true,
        otp,
        link: whatsappLink,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  async initiateWhatsAppToWeb(waNumber: string): Promise<HybridLinkResult> {
    const normalizedNumber = this.normalizePhoneNumber(waNumber);

    try {
      let session = await sessionManager.getSessionByPhone(normalizedNumber);
      
      if (!session) {
        const { session_id } = await sessionManager.getOrCreateSession(normalizedNumber, 'hybrid');
        session = await sessionManager.getSession(session_id);
      } else {
        await sessionManager.syncFromPlatform(session.id, 'hybrid', {});
      }

      if (!session) {
        return { success: false, error: 'Failed to create session' };
      }

      const otp = await webRegistrationFlow.generateOTP(
        normalizedNumber,
        'hybrid_link',
        session.id
      );

      return {
        success: true,
        otp,
        link: otp.verification_link,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  async validateHybridOTP(
    waNumber: string,
    otpCode: string,
    _targetPlatform: PlatformSource
  ): Promise<PlatformSwitchResult> {
    const normalizedNumber = this.normalizePhoneNumber(waNumber);

    const validation = await webRegistrationFlow.validateOTP(normalizedNumber, otpCode);

    if (!validation.is_valid) {
      return {
        success: false,
        error: validation.error_message || 'Invalid OTP',
      };
    }

    let session: RegistrationSession | null = null;

    if (validation.session_id) {
      session = await sessionManager.getSession(validation.session_id);
    }

    if (!session) {
      session = await sessionManager.getSessionByPhone(normalizedNumber);
    }

    if (!session) {
      const { session_id } = await sessionManager.getOrCreateSession(normalizedNumber, 'hybrid');
      session = await sessionManager.getSession(session_id);
    }

    if (session) {
      await sessionManager.syncFromPlatform(session.id, 'hybrid', {});
      
      const nextStep = await sessionManager.isDataComplete(session.id) 
        ? 'verification' 
        : 'data_collection';
      await sessionManager.updateProgress(session.id, nextStep);
      
      session = await sessionManager.getSession(session.id);
    }

    return {
      success: true,
      session: session || undefined,
    };
  }

  async syncDataFromPlatform(
    sessionId: string,
    _source: PlatformSource,
    data: Partial<RegistrationCollectedData>
  ): Promise<MergeResult> {
    const session = await sessionManager.getSession(sessionId);
    
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    const existingData = session.collected_data;
    const { mergedData, conflicts } = this.mergeData(existingData, data);

    const success = await sessionManager.syncFromPlatform(sessionId, 'hybrid', mergedData);

    if (!success) {
      return { success: false, error: 'Failed to sync data' };
    }

    return {
      success: true,
      mergedData,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
    };
  }

  private mergeData(
    existing: RegistrationCollectedData,
    incoming: Partial<RegistrationCollectedData>
  ): { mergedData: RegistrationCollectedData; conflicts: string[] } {
    const conflicts: string[] = [];
    const mergedData: RegistrationCollectedData = { ...existing };

    const fields: (keyof RegistrationCollectedData)[] = ['store_name', 'owner_name', 'pin_hash'];

    for (const field of fields) {
      const existingValue = existing[field];
      const incomingValue = incoming[field];

      if (incomingValue !== undefined) {
        if (existingValue && existingValue !== incomingValue && field !== 'pin_hash') {
          conflicts.push(`${field}: existing="${existingValue}" vs incoming="${incomingValue}"`);
        }
        (mergedData as Record<string, unknown>)[field] = incomingValue;
      }
    }

    if (incoming.contact_info) {
      mergedData.contact_info = {
        ...existing.contact_info,
        ...incoming.contact_info,
      };
    }

    return { mergedData, conflicts };
  }

  async getHybridSessionStatus(waNumber: string): Promise<{
    hasSession: boolean;
    session?: RegistrationSession;
    isHybrid: boolean;
    platforms: PlatformSource[];
    dataComplete: boolean;
    missingFields: string[];
  }> {
    const normalizedNumber = this.normalizePhoneNumber(waNumber);
    const session = await sessionManager.getSessionByPhone(normalizedNumber);

    if (!session) {
      return {
        hasSession: false,
        isHybrid: false,
        platforms: [],
        dataComplete: false,
        missingFields: ['store_name', 'owner_name', 'pin_hash'],
      };
    }

    const isHybrid = session.source_platform === 'hybrid';
    const platforms: PlatformSource[] = isHybrid ? ['whatsapp', 'web'] : [session.source_platform as PlatformSource];

    const missingFields: string[] = [];
    if (!session.collected_data.store_name) missingFields.push('store_name');
    if (!session.collected_data.owner_name) missingFields.push('owner_name');
    if (!session.collected_data.pin_hash) missingFields.push('pin_hash');

    return {
      hasSession: true,
      session,
      isHybrid,
      platforms,
      dataComplete: missingFields.length === 0,
      missingFields,
    };
  }

  async completeHybridRegistration(sessionId: string): Promise<{
    success: boolean;
    user?: User;
    token?: string;
    error?: string;
  }> {
    const isComplete = await sessionManager.isDataComplete(sessionId);
    
    if (!isComplete) {
      const session = await sessionManager.getSession(sessionId);
      const missing: string[] = [];
      if (!session?.collected_data.store_name) missing.push('nama toko');
      if (!session?.collected_data.owner_name) missing.push('nama pemilik');
      if (!session?.collected_data.pin_hash) missing.push('PIN');

      return {
        success: false,
        error: `Data belum lengkap. Masih perlu: ${missing.join(', ')}`,
      };
    }

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
  }

  async transferSession(
    waNumber: string,
    _fromPlatform: PlatformSource,
    _toPlatform: PlatformSource
  ): Promise<PlatformSwitchResult> {
    const normalizedNumber = this.normalizePhoneNumber(waNumber);
    const session = await sessionManager.getSessionByPhone(normalizedNumber);

    if (!session) {
      return { success: false, error: 'No active session found' };
    }

    await sessionManager.syncFromPlatform(session.id, 'hybrid', {});
    await sessionManager.extendSessionTTL(session.id);

    const updatedSession = await sessionManager.getSession(session.id);

    return {
      success: true,
      session: updatedSession || undefined,
    };
  }

  async cancelHybridSession(waNumber: string): Promise<boolean> {
    const normalizedNumber = this.normalizePhoneNumber(waNumber);
    const session = await sessionManager.getSessionByPhone(normalizedNumber);

    if (!session) {
      return false;
    }

    return sessionManager.expireSession(session.id);
  }

  private buildWhatsAppLink(_waNumber: string, otpCode: string): string {
    const botNumber = env.WHATSAPP_BOT_NUMBER.replace(/\D/g, '');
    const message = encodeURIComponent(`VERIFY ${otpCode}`);
    return `https://wa.me/${botNumber}?text=${message}`;
  }

  private generateToken(user: User): string {
    return jwt.sign(
      { userId: user.id, waNumber: user.wa_number },
      env.JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
  }
}

export const hybridRegistrationFlow = new HybridRegistrationFlow();
