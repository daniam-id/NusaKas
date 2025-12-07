import { getSupabase } from '../config/supabase.js';
import type {
  RegistrationSession,
  RegistrationCollectedData,
  RegistrationStep,
  RegistrationMethod,
  CreateSessionResponse,
  RegistrationStatus,
} from '../types/index.js';

const SESSION_TTL_MINUTES = 30;

export class SessionManager {
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

  async getOrCreateSession(
    waNumber: string,
    sourcePlatform: RegistrationMethod = 'whatsapp'
  ): Promise<CreateSessionResponse> {
    const supabase = getSupabase();
    const normalizedNumber = this.normalizePhoneNumber(waNumber);

    const { data, error } = await supabase.rpc('get_or_create_registration_session', {
      p_wa_number: normalizedNumber,
      p_source_platform: sourcePlatform,
    });

    if (error) {
      throw new Error(`Failed to get/create session: ${error.message}`);
    }

    const result = data[0];
    return {
      session_id: result.session_id,
      is_new: result.is_new,
      current_step: result.current_step as RegistrationStep,
      collected_data: (result.collected_data || {}) as RegistrationCollectedData,
    };
  }

  async getSession(sessionId: string): Promise<RegistrationSession | null> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('registration_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToSession(data);
  }

  async getSessionByPhone(waNumber: string): Promise<RegistrationSession | null> {
    const supabase = getSupabase();
    const normalizedNumber = this.normalizePhoneNumber(waNumber);

    const { data, error } = await supabase
      .from('registration_sessions')
      .select('*')
      .eq('wa_number', normalizedNumber)
      .in('status', ['pending', 'active'])
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToSession(data);
  }

  async updateProgress(
    sessionId: string,
    step?: RegistrationStep,
    data?: Partial<RegistrationCollectedData>
  ): Promise<boolean> {
    const supabase = getSupabase();

    const { data: result, error } = await supabase.rpc('update_registration_progress', {
      p_session_id: sessionId,
      p_step: step || null,
      p_data: data || null,
    });

    if (error) {
      console.error('[SessionManager] Update progress error:', error.message);
      return false;
    }

    return result === true;
  }

  async updateSessionData(
    sessionId: string,
    data: Partial<RegistrationCollectedData>
  ): Promise<boolean> {
    return this.updateProgress(sessionId, undefined, data);
  }

  async updateSessionStep(sessionId: string, step: RegistrationStep): Promise<boolean> {
    return this.updateProgress(sessionId, step, undefined);
  }

  async setSessionActive(sessionId: string): Promise<boolean> {
    const supabase = getSupabase();

    const { error } = await supabase
      .from('registration_sessions')
      .update({
        status: 'active' as RegistrationStatus,
        expires_at: new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000).toISOString(),
      })
      .eq('id', sessionId)
      .in('status', ['pending', 'active']);

    return !error;
  }

  async expireSession(sessionId: string): Promise<boolean> {
    const supabase = getSupabase();

    const { error } = await supabase
      .from('registration_sessions')
      .update({ status: 'expired' as RegistrationStatus })
      .eq('id', sessionId);

    return !error;
  }

  async completeSession(sessionId: string): Promise<{
    success: boolean;
    user_id: string | null;
    error_message: string | null;
  }> {
    const supabase = getSupabase();

    const { data, error } = await supabase.rpc('complete_registration', {
      p_session_id: sessionId,
    });

    if (error) {
      return {
        success: false,
        user_id: null,
        error_message: error.message,
      };
    }

    const result = data[0];
    return {
      success: result.success,
      user_id: result.user_id,
      error_message: result.error_message,
    };
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const supabase = getSupabase();

    const { error } = await supabase
      .from('registration_sessions')
      .delete()
      .eq('id', sessionId);

    return !error;
  }

  async extendSessionTTL(sessionId: string): Promise<boolean> {
    const supabase = getSupabase();
    const newExpiry = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000);

    const { error } = await supabase
      .from('registration_sessions')
      .update({ expires_at: newExpiry.toISOString() })
      .eq('id', sessionId)
      .in('status', ['pending', 'active']);

    return !error;
  }

  async isSessionValid(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) return false;

    const isExpired = new Date(session.expires_at) < new Date();
    const isActiveStatus = session.status === 'pending' || session.status === 'active';

    return !isExpired && isActiveStatus;
  }

  async hasActiveSession(waNumber: string): Promise<boolean> {
    const session = await this.getSessionByPhone(waNumber);
    return session !== null;
  }

  async getCollectedData(sessionId: string): Promise<RegistrationCollectedData | null> {
    const session = await this.getSession(sessionId);
    return session?.collected_data || null;
  }

  async isDataComplete(sessionId: string): Promise<boolean> {
    const data = await this.getCollectedData(sessionId);
    if (!data) return false;

    return !!(data.store_name && data.owner_name && data.pin_hash);
  }

  async getNextMissingField(sessionId: string): Promise<keyof RegistrationCollectedData | null> {
    const data = await this.getCollectedData(sessionId);
    if (!data) return 'store_name';

    if (!data.store_name) return 'store_name';
    if (!data.owner_name) return 'owner_name';
    if (!data.pin_hash) return 'pin_hash';

    return null;
  }

  async syncFromPlatform(
    sessionId: string,
    sourcePlatform: RegistrationMethod,
    data: Partial<RegistrationCollectedData>
  ): Promise<boolean> {
    const supabase = getSupabase();

    const session = await this.getSession(sessionId);
    if (!session) return false;

    const mergedData = { ...session.collected_data, ...data };
    const newPlatform: RegistrationMethod =
      session.source_platform !== sourcePlatform ? 'hybrid' : session.source_platform;

    const { error } = await supabase
      .from('registration_sessions')
      .update({
        collected_data: mergedData,
        source_platform: newPlatform,
        expires_at: new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000).toISOString(),
      })
      .eq('id', sessionId);

    return !error;
  }

  async cleanupExpiredSessions(): Promise<number> {
    const supabase = getSupabase();

    const { data, error } = await supabase.rpc('cleanup_expired_registration_sessions');

    if (error) {
      console.error('[SessionManager] Cleanup error:', error.message);
      return 0;
    }

    return data || 0;
  }

  async getSessionStats(): Promise<{
    active: number;
    pending: number;
    completed: number;
    expired: number;
  }> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('registration_sessions')
      .select('status');

    if (error || !data) {
      return { active: 0, pending: 0, completed: 0, expired: 0 };
    }

    return data.reduce(
      (acc, row) => {
        const status = row.status as RegistrationStatus;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      { active: 0, pending: 0, completed: 0, expired: 0 }
    );
  }

  private mapToSession(data: Record<string, unknown>): RegistrationSession {
    return {
      id: data.id as string,
      wa_number: data.wa_number as string,
      source_platform: data.source_platform as RegistrationMethod,
      current_step: data.current_step as RegistrationStep,
      collected_data: (data.collected_data || {}) as RegistrationCollectedData,
      status: data.status as RegistrationStatus,
      created_at: data.created_at as string,
      updated_at: data.updated_at as string,
      expires_at: data.expires_at as string,
    };
  }
}

export const sessionManager = new SessionManager();
