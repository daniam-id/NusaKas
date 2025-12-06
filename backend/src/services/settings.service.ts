import { getSupabase } from '../config/supabase.js';
import type { UserSettings, ValidationResult, BotStyle } from '../types/index.js';

const VALID_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const VALID_STYLES: BotStyle[] = ['formal', 'santai', 'semi-formal'];
const TIME_REGEX = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;

export class SettingsService {
  async getSettings(userId: string): Promise<UserSettings | null> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('users')
      .select('reminder_time, operational_days, bot_style, use_emoji')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      reminder_time: data.reminder_time || '21:00',
      operational_days: data.operational_days || VALID_DAYS.slice(0, 6),
      bot_style: data.bot_style || 'santai',
      use_emoji: data.use_emoji ?? true,
    };
  }

  async updateSettings(userId: string, settings: Partial<UserSettings>): Promise<UserSettings | null> {
    const validation = this.validateSettings(settings);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const supabase = getSupabase();
    const updateData: Record<string, unknown> = {};

    if (settings.reminder_time !== undefined) {
      updateData.reminder_time = settings.reminder_time;
    }
    if (settings.operational_days !== undefined) {
      updateData.operational_days = settings.operational_days;
    }
    if (settings.bot_style !== undefined) {
      updateData.bot_style = settings.bot_style;
    }
    if (settings.use_emoji !== undefined) {
      updateData.use_emoji = settings.use_emoji;
    }

    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId);

    if (error) {
      throw new Error(`Gagal update settings: ${error.message}`);
    }

    return this.getSettings(userId);
  }

  validateSettings(settings: Partial<UserSettings>): ValidationResult {
    const errors: string[] = [];

    if (settings.reminder_time !== undefined) {
      if (!TIME_REGEX.test(settings.reminder_time)) {
        errors.push('Format waktu tidak valid. Gunakan format HH:mm (contoh: 21:00)');
      }
    }

    if (settings.operational_days !== undefined) {
      if (!Array.isArray(settings.operational_days)) {
        errors.push('Hari operasional harus berupa array');
      } else {
        const invalidDays = settings.operational_days.filter(d => !VALID_DAYS.includes(d.toLowerCase()));
        if (invalidDays.length > 0) {
          errors.push(`Hari tidak valid: ${invalidDays.join(', ')}`);
        }
        if (settings.operational_days.length === 0) {
          errors.push('Minimal pilih satu hari operasional');
        }
      }
    }

    if (settings.bot_style !== undefined) {
      if (!VALID_STYLES.includes(settings.bot_style)) {
        errors.push(`Gaya bahasa tidak valid. Pilih: ${VALID_STYLES.join(', ')}`);
      }
    }

    if (settings.use_emoji !== undefined) {
      if (typeof settings.use_emoji !== 'boolean') {
        errors.push('Preferensi emoji harus true atau false');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async markOnboardingComplete(userId: string): Promise<void> {
    const supabase = getSupabase();

    const { error } = await supabase
      .from('users')
      .update({ onboarding_complete: true })
      .eq('id', userId);

    if (error) {
      throw new Error(`Gagal update onboarding: ${error.message}`);
    }
  }

  parseTimeFromText(text: string): string | null {
    const lowerText = text.toLowerCase().trim();

    // Format: "21:00", "21.00", "9:30"
    const colonMatch = lowerText.match(/(\d{1,2})[:.](\d{2})/);
    if (colonMatch) {
      const hour = parseInt(colonMatch[1], 10);
      const minute = colonMatch[2];
      if (hour >= 0 && hour <= 23) {
        return `${hour.toString().padStart(2, '0')}:${minute}`;
      }
    }

    // Format: "9 malam", "8 pagi"
    const periodMatch = lowerText.match(/(\d{1,2})\s*(pagi|siang|sore|malam)/);
    if (periodMatch) {
      let hour = parseInt(periodMatch[1], 10);
      const period = periodMatch[2];

      if (period === 'malam' && hour < 12) hour += 12;
      if (period === 'sore' && hour < 12) hour += 12;
      if (period === 'pagi' && hour === 12) hour = 0;

      if (hour >= 0 && hour <= 23) {
        return `${hour.toString().padStart(2, '0')}:00`;
      }
    }

    // Format: single number "21", "9"
    const singleMatch = lowerText.match(/^(\d{1,2})$/);
    if (singleMatch) {
      const hour = parseInt(singleMatch[1], 10);
      if (hour >= 0 && hour <= 23) {
        return `${hour.toString().padStart(2, '0')}:00`;
      }
    }

    return null;
  }

  parseDaysFromText(text: string): string[] | null {
    const lowerText = text.toLowerCase();

    const dayMap: Record<string, string> = {
      'senin': 'monday', 'monday': 'monday',
      'selasa': 'tuesday', 'tuesday': 'tuesday',
      'rabu': 'wednesday', 'wednesday': 'wednesday',
      'kamis': 'thursday', 'thursday': 'thursday',
      'jumat': 'friday', 'jum\'at': 'friday', 'friday': 'friday',
      'sabtu': 'saturday', 'saturday': 'saturday',
      'minggu': 'sunday', 'sunday': 'sunday',
    };

    const days: string[] = [];

    // Handle exclusion FIRST: "libur minggu", "kecuali minggu", "tutup minggu"
    if (lowerText.includes('libur') || lowerText.includes('kecuali') || lowerText.includes('tutup')) {
      const excludeMatch = lowerText.match(/(?:libur|kecuali|tutup)\s+(?:hari\s+)?(\w+)/);
      if (excludeMatch) {
        const excludeDay = dayMap[excludeMatch[1]];
        if (excludeDay) {
          return VALID_DAYS.filter(d => d !== excludeDay);
        }
      }
    }

    // Handle range: "senin sampai sabtu"
    const rangeMatch = lowerText.match(/(\w+)\s*(?:sampai|s\/d|-|hingga)\s*(\w+)/);
    if (rangeMatch) {
      const startDay = dayMap[rangeMatch[1]];
      const endDay = dayMap[rangeMatch[2]];
      if (startDay && endDay) {
        const startIdx = VALID_DAYS.indexOf(startDay);
        const endIdx = VALID_DAYS.indexOf(endDay);
        if (startIdx !== -1 && endIdx !== -1) {
          for (let i = startIdx; i <= endIdx; i++) {
            days.push(VALID_DAYS[i]);
          }
          return days.length > 0 ? days : null;
        }
      }
    }

    // Handle list: "senin, rabu, jumat" or "senin rabu jumat"
    for (const [indonesian, english] of Object.entries(dayMap)) {
      if (lowerText.includes(indonesian) && !days.includes(english)) {
        days.push(english);
      }
    }

    return days.length > 0 ? days : null;
  }
}

export const settingsService = new SettingsService();
