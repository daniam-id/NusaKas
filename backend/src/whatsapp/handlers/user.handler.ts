import { WASocket } from '@whiskeysockets/baileys';
import { getSupabase } from '../../config/supabase.js';
import type { BotStyle } from '../../types/index.js';

interface UserRecord {
  id: string;
  wa_number: string;
  full_name?: string;
  store_name?: string;
  bot_style?: BotStyle;
  use_emoji?: boolean;
  onboarding_complete?: boolean;
}

type OnboardingState = 'none' | 'awaiting_style' | 'awaiting_emoji';

// In-memory onboarding state (per user)
const onboardingStates = new Map<string, OnboardingState>();

export function getOnboardingState(waNumber: string): OnboardingState {
  return onboardingStates.get(waNumber) || 'none';
}

export function setOnboardingState(waNumber: string, state: OnboardingState): void {
  if (state === 'none') {
    onboardingStates.delete(waNumber);
  } else {
    onboardingStates.set(waNumber, state);
  }
}

class UserHandler {
  async ensureUser(waNumber: string, sock: WASocket, jid: string): Promise<UserRecord | null> {
    const supabase = getSupabase();
    
    // Normalize phone number
    let normalized = waNumber.replace(/\D/g, '');
    if (normalized.startsWith('0')) {
      normalized = '62' + normalized.slice(1);
    }
    if (!normalized.startsWith('62')) {
      normalized = '62' + normalized;
    }

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, wa_number, full_name, store_name, bot_style, use_emoji, onboarding_complete')
      .eq('wa_number', normalized)
      .single();

    if (existingUser) {
      return existingUser as UserRecord;
    }

    // Auto-register new user
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        wa_number: normalized,
        full_name: 'Juragan',
        onboarding_complete: false,
      })
      .select('id, wa_number, full_name, store_name, bot_style, use_emoji, onboarding_complete')
      .single();

    if (error) {
      console.error('[WA] Failed to create user:', error);
      return null;
    }

    // Send welcome message
    await sock.sendMessage(jid, {
      text: `🎉 *Selamat datang di NusaKas!*

Hai Juragan! Akun kamu sudah terdaftar otomatis.

Mulai catat keuangan dengan:
• Ketik "masuk 50rb" untuk pemasukan
• Ketik "keluar 20rb" untuk pengeluaran
• Kirim foto struk untuk catat otomatis

Ketik "help" untuk bantuan lengkap.`,
    });

    return newUser as UserRecord;
  }

  async updateUserSettings(
    waNumber: string,
    settings: Partial<{ bot_style: BotStyle; use_emoji: boolean; onboarding_complete: boolean }>
  ): Promise<void> {
    const supabase = getSupabase();

    let normalized = waNumber.replace(/\D/g, '');
    if (normalized.startsWith('0')) {
      normalized = '62' + normalized.slice(1);
    }
    if (!normalized.startsWith('62')) {
      normalized = '62' + normalized;
    }

    const { error } = await supabase
      .from('users')
      .update(settings)
      .eq('wa_number', normalized);

    if (error) {
      console.error('[WA] Failed to update user settings:', error);
    }
  }

  async getUser(waNumber: string): Promise<UserRecord | null> {
    const supabase = getSupabase();
    
    let normalized = waNumber.replace(/\D/g, '');
    if (normalized.startsWith('0')) {
      normalized = '62' + normalized.slice(1);
    }
    if (!normalized.startsWith('62')) {
      normalized = '62' + normalized;
    }

    const { data } = await supabase
      .from('users')
      .select('id, wa_number, full_name, store_name, bot_style, use_emoji, onboarding_complete')
      .eq('wa_number', normalized)
      .single();

    return data as UserRecord | null;
  }
}

export type { UserRecord };

export const userHandler = new UserHandler();
