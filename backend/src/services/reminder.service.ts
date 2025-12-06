import cron, { ScheduledTask } from 'node-cron';
import { getSupabase } from '../config/supabase.js';
import { formatReplyService } from './format-reply.service.js';
import type { User } from '../types/index.js';

const DAY_MAP: Record<number, string> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

type SendMessageFn = (waNumber: string, text: string) => Promise<void>;

export class ReminderService {
  private cronJob: ScheduledTask | null = null;
  private sendMessage: SendMessageFn | null = null;

  setSendMessageFn(fn: SendMessageFn): void {
    this.sendMessage = fn;
  }

  startScheduler(): void {
    if (this.cronJob) {
      console.log('[Reminder] Scheduler already running');
      return;
    }

    // Run every minute
    this.cronJob = cron.schedule('* * * * *', async () => {
      await this.checkAndSendReminders();
    });

    console.log('[Reminder] Scheduler started');
  }

  stopScheduler(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('[Reminder] Scheduler stopped');
    }
  }

  private async checkAndSendReminders(): Promise<void> {
    try {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`;
      const currentDay = DAY_MAP[now.getDay()];

      const users = await this.getUsersForReminder(currentTime, currentDay);

      if (users.length > 0) {
        console.log(`[Reminder] Sending reminders to ${users.length} users at ${currentTime}`);
      }

      for (const user of users) {
        await this.sendReminder(user);
      }
    } catch (error) {
      console.error('[Reminder] Error checking reminders:', error);
    }
  }

  private async getUsersForReminder(time: string, day: string): Promise<User[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('reminder_time', time)
      .eq('onboarding_complete', true)
      .contains('operational_days', [day]);

    if (error) {
      console.error('[Reminder] Query error:', error.message);
      // Fallback to raw query if JSONB contains fails
      try {
        const { data: rawData, error: rawError } = await supabase
          .rpc('get_users_for_reminder', {
            p_time: time,
            p_day: day
          });
        
        if (rawError) {
          console.error('[Reminder] RPC query error:', rawError.message);
          return [];
        }
        
        return (rawData || []) as User[];
      } catch (fallbackError) {
        console.error('[Reminder] Fallback query error:', fallbackError);
        return [];
      }
    }

    return (data || []) as User[];
  }

  async sendReminder(user: User): Promise<void> {
    if (!this.sendMessage) {
      console.error('[Reminder] Send message function not set');
      return;
    }

    try {
      const message = formatReplyService.formatReminderMessage(user);
      await this.sendMessage(user.wa_number, message);
      console.log(`[Reminder] Sent to ${user.wa_number}`);
    } catch (error) {
      console.error(`[Reminder] Failed to send to ${user.wa_number}:`, error);
    }
  }

  async sendTestReminder(userId: string): Promise<boolean> {
    const supabase = getSupabase();

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !user) {
      console.error('[Reminder] User not found:', userId);
      return false;
    }

    await this.sendReminder(user as User);
    return true;
  }

  isRunning(): boolean {
    return this.cronJob !== null;
  }
}

export const reminderService = new ReminderService();
