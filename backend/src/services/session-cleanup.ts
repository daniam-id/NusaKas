import { getSupabase } from '../config/supabase.js';
import { sessionManager } from './session-manager.js';
import { webRegistrationFlow } from './web-registration.js';

const DEFAULT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface CleanupResult {
  sessionsExpired: number;
  otpsExpired: number;
  pendingRegistrationsDeleted: number;
  errors: string[];
}

interface CleanupStats {
  lastRun: Date | null;
  totalSessionsExpired: number;
  totalOtpsExpired: number;
  totalPendingDeleted: number;
  runCount: number;
  errors: string[];
}

class SessionCleanupService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private stats: CleanupStats = {
    lastRun: null,
    totalSessionsExpired: 0,
    totalOtpsExpired: 0,
    totalPendingDeleted: 0,
    runCount: 0,
    errors: [],
  };

  async runCleanup(): Promise<CleanupResult> {
    if (this.isRunning) {
      console.log('[Cleanup] Cleanup already in progress, skipping');
      return {
        sessionsExpired: 0,
        otpsExpired: 0,
        pendingRegistrationsDeleted: 0,
        errors: ['Cleanup already in progress'],
      };
    }

    this.isRunning = true;
    const result: CleanupResult = {
      sessionsExpired: 0,
      otpsExpired: 0,
      pendingRegistrationsDeleted: 0,
      errors: [],
    };

    try {
      const sessionsResult = await this.cleanupExpiredSessions();
      result.sessionsExpired = sessionsResult;

      const otpsResult = await this.cleanupExpiredOTPs();
      result.otpsExpired = otpsResult;

      const pendingResult = await this.cleanupExpiredPendingRegistrations();
      result.pendingRegistrationsDeleted = pendingResult;

      this.updateStats(result);

      console.log(
        `[Cleanup] Completed: ${result.sessionsExpired} sessions, ${result.otpsExpired} OTPs, ${result.pendingRegistrationsDeleted} pending registrations`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(message);
      this.stats.errors.push(`${new Date().toISOString()}: ${message}`);
      console.error('[Cleanup] Error during cleanup:', message);
    } finally {
      this.isRunning = false;
    }

    return result;
  }

  private async cleanupExpiredSessions(): Promise<number> {
    try {
      const count = await sessionManager.cleanupExpiredSessions();
      return count;
    } catch (error) {
      console.error('[Cleanup] Error cleaning sessions:', error);
      return 0;
    }
  }

  private async cleanupExpiredOTPs(): Promise<number> {
    try {
      const count = await webRegistrationFlow.cleanupExpiredOTPs();
      return count;
    } catch (error) {
      console.error('[Cleanup] Error cleaning OTPs:', error);
      return 0;
    }
  }

  private async cleanupExpiredPendingRegistrations(): Promise<number> {
    const supabase = getSupabase();

    try {
      const { data, error } = await supabase
        .from('pending_registrations')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('wa_number');

      if (error) {
        console.error('[Cleanup] Error cleaning pending registrations:', error.message);
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      console.error('[Cleanup] Error cleaning pending registrations:', error);
      return 0;
    }
  }

  async cleanupOldCompletedSessions(daysOld: number = 30): Promise<number> {
    const supabase = getSupabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    try {
      const { data, error } = await supabase
        .from('registration_sessions')
        .delete()
        .eq('status', 'completed')
        .lt('updated_at', cutoffDate.toISOString())
        .select('id');

      if (error) {
        console.error('[Cleanup] Error cleaning old completed sessions:', error.message);
        return 0;
      }

      const count = data?.length || 0;
      if (count > 0) {
        console.log(`[Cleanup] Removed ${count} old completed sessions (>${daysOld} days)`);
      }
      return count;
    } catch (error) {
      console.error('[Cleanup] Error cleaning old completed sessions:', error);
      return 0;
    }
  }

  async cleanupOldUsedOTPs(daysOld: number = 7): Promise<number> {
    const supabase = getSupabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    try {
      const { data, error } = await supabase
        .from('otp_verifications')
        .delete()
        .in('status', ['used', 'expired'])
        .lt('created_at', cutoffDate.toISOString())
        .select('id');

      if (error) {
        console.error('[Cleanup] Error cleaning old OTPs:', error.message);
        return 0;
      }

      const count = data?.length || 0;
      if (count > 0) {
        console.log(`[Cleanup] Removed ${count} old used/expired OTPs (>${daysOld} days)`);
      }
      return count;
    } catch (error) {
      console.error('[Cleanup] Error cleaning old OTPs:', error);
      return 0;
    }
  }

  async runDeepCleanup(): Promise<{
    expiredSessions: number;
    expiredOTPs: number;
    oldCompletedSessions: number;
    oldUsedOTPs: number;
    pendingRegistrations: number;
  }> {
    console.log('[Cleanup] Starting deep cleanup...');

    const regularResult = await this.runCleanup();
    const oldSessions = await this.cleanupOldCompletedSessions(30);
    const oldOTPs = await this.cleanupOldUsedOTPs(7);

    const result = {
      expiredSessions: regularResult.sessionsExpired,
      expiredOTPs: regularResult.otpsExpired,
      oldCompletedSessions: oldSessions,
      oldUsedOTPs: oldOTPs,
      pendingRegistrations: regularResult.pendingRegistrationsDeleted,
    };

    console.log('[Cleanup] Deep cleanup completed:', result);
    return result;
  }

  startPeriodicCleanup(intervalMs: number = DEFAULT_CLEANUP_INTERVAL_MS): void {
    if (this.intervalId) {
      console.log('[Cleanup] Periodic cleanup already running');
      return;
    }

    console.log(`[Cleanup] Starting periodic cleanup (every ${intervalMs / 1000}s)`);
    
    this.runCleanup();

    this.intervalId = setInterval(() => {
      this.runCleanup();
    }, intervalMs);
  }

  stopPeriodicCleanup(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[Cleanup] Periodic cleanup stopped');
    }
  }

  isPeriodicCleanupRunning(): boolean {
    return this.intervalId !== null;
  }

  getStats(): CleanupStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      lastRun: null,
      totalSessionsExpired: 0,
      totalOtpsExpired: 0,
      totalPendingDeleted: 0,
      runCount: 0,
      errors: [],
    };
  }

  private updateStats(result: CleanupResult): void {
    this.stats.lastRun = new Date();
    this.stats.totalSessionsExpired += result.sessionsExpired;
    this.stats.totalOtpsExpired += result.otpsExpired;
    this.stats.totalPendingDeleted += result.pendingRegistrationsDeleted;
    this.stats.runCount += 1;

    if (this.stats.errors.length > 100) {
      this.stats.errors = this.stats.errors.slice(-50);
    }
  }

  async getTableStats(): Promise<{
    activeSessions: number;
    pendingSessions: number;
    completedSessions: number;
    expiredSessions: number;
    pendingOTPs: number;
    usedOTPs: number;
    expiredOTPs: number;
    pendingRegistrations: number;
  }> {
    const supabase = getSupabase();

    const [sessionsResult, otpsResult, pendingResult] = await Promise.all([
      supabase.from('registration_sessions').select('status'),
      supabase.from('otp_verifications').select('status'),
      supabase.from('pending_registrations').select('wa_number'),
    ]);

    const sessionCounts = {
      active: 0,
      pending: 0,
      completed: 0,
      expired: 0,
    };

    if (sessionsResult.data) {
      for (const row of sessionsResult.data) {
        const status = row.status as keyof typeof sessionCounts;
        if (status in sessionCounts) {
          sessionCounts[status]++;
        }
      }
    }

    const otpCounts = {
      pending: 0,
      used: 0,
      expired: 0,
    };

    if (otpsResult.data) {
      for (const row of otpsResult.data) {
        const status = row.status as keyof typeof otpCounts;
        if (status in otpCounts) {
          otpCounts[status]++;
        }
      }
    }

    return {
      activeSessions: sessionCounts.active,
      pendingSessions: sessionCounts.pending,
      completedSessions: sessionCounts.completed,
      expiredSessions: sessionCounts.expired,
      pendingOTPs: otpCounts.pending,
      usedOTPs: otpCounts.used,
      expiredOTPs: otpCounts.expired,
      pendingRegistrations: pendingResult.data?.length || 0,
    };
  }
}

export const sessionCleanupService = new SessionCleanupService();
