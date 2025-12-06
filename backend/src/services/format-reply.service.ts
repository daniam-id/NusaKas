import type { User, BotStyle } from '../types/index.js';

type MessageIntent = 
  | 'WELCOME'
  | 'ONBOARDING_STYLE'
  | 'ONBOARDING_EMOJI'
  | 'ONBOARDING_COMPLETE'
  | 'REMINDER'
  | 'VERIFY_SUCCESS'
  | 'VERIFY_FAILED'
  | 'SETTINGS_UPDATED'
  | 'TRANSACTION_ADDED'
  | 'BALANCE'
  | 'ERROR';

interface MessagePayload {
  name?: string;
  amount?: number;
  balance?: number;
  setting?: string;
  value?: string;
  error?: string;
}

const TEMPLATES: Record<MessageIntent, Record<BotStyle, string>> = {
  WELCOME: {
    formal: 'Selamat datang di NusaKas, {name}. Kami siap membantu pencatatan keuangan usaha Anda.',
    santai: 'Halo {name}! Selamat datang di NusaKas. Yuk mulai catat keuangan usahamu!',
    'semi-formal': 'Selamat datang di NusaKas, {name}. Mari kita mulai mencatat keuangan usaha Anda.',
  },
  ONBOARDING_STYLE: {
    formal: 'Silakan pilih gaya bahasa yang Anda inginkan:\n1. Formal\n2. Santai\n3. Semi-formal\n\nBalas dengan angka 1, 2, atau 3.',
    santai: 'Pilih gaya chat yang kamu mau ya:\n1. Formal (kaku gitu)\n2. Santai (kayak temen)\n3. Semi-formal (tengah-tengah)\n\nBalas pake angka aja!',
    'semi-formal': 'Silakan pilih gaya bahasa:\n1. Formal\n2. Santai\n3. Semi-formal\n\nBalas dengan angka 1, 2, atau 3.',
  },
  ONBOARDING_EMOJI: {
    formal: 'Apakah Anda ingin pesan dilengkapi dengan emoji?\n1. Ya\n2. Tidak\n\nBalas dengan angka 1 atau 2.',
    santai: 'Mau pake emoji gak di chat-nya?\n1. Mau dong!\n2. Gak usah deh\n\nBalas pake angka ya!',
    'semi-formal': 'Apakah ingin menggunakan emoji di pesan?\n1. Ya\n2. Tidak\n\nBalas dengan angka.',
  },
  ONBOARDING_COMPLETE: {
    formal: 'Terima kasih. Pengaturan Anda telah disimpan. Anda dapat langsung mencatat transaksi dengan mengirim pesan seperti "masuk 50rb" atau "keluar 20rb makan".',
    santai: 'Mantap! Settingan udah ke-save. Langsung aja catat transaksi, misal: "masuk 50rb" atau "keluar 20rb makan". Gampang kan?',
    'semi-formal': 'Pengaturan tersimpan. Silakan mulai mencatat transaksi, contoh: "masuk 50rb" atau "keluar 20rb makan".',
  },
  REMINDER: {
    formal: 'Selamat malam, {name}. Ini pengingat untuk mencatat transaksi hari ini. Apakah ada pemasukan atau pengeluaran yang belum dicatat?',
    santai: 'Hai {name}! Udah malem nih, jangan lupa catat transaksi hari ini ya. Ada yang belum dicatat?',
    'semi-formal': 'Halo {name}, pengingat untuk mencatat transaksi hari ini. Ada yang perlu dicatat?',
  },
  VERIFY_SUCCESS: {
    formal: 'Verifikasi berhasil. Akun Anda telah aktif.',
    santai: 'Yes! Verifikasi berhasil. Akun kamu udah aktif!',
    'semi-formal': 'Verifikasi berhasil. Akun Anda sudah aktif.',
  },
  VERIFY_FAILED: {
    formal: 'Mohon maaf, verifikasi gagal. {error}',
    santai: 'Waduh, verifikasi gagal nih. {error}',
    'semi-formal': 'Maaf, verifikasi gagal. {error}',
  },
  SETTINGS_UPDATED: {
    formal: 'Pengaturan {setting} telah diperbarui menjadi {value}.',
    santai: 'Oke! {setting} udah diubah jadi {value}.',
    'semi-formal': 'Pengaturan {setting} sudah diupdate ke {value}.',
  },
  TRANSACTION_ADDED: {
    formal: 'Transaksi sebesar Rp{amount} telah dicatat.',
    santai: 'Sip! Transaksi Rp{amount} udah ke-catat.',
    'semi-formal': 'Transaksi Rp{amount} sudah dicatat.',
  },
  BALANCE: {
    formal: 'Saldo Anda saat ini: Rp{balance}',
    santai: 'Saldo kamu sekarang: Rp{balance}',
    'semi-formal': 'Saldo saat ini: Rp{balance}',
  },
  ERROR: {
    formal: 'Mohon maaf, terjadi kesalahan. {error}',
    santai: 'Waduh, ada error nih. {error}',
    'semi-formal': 'Maaf, terjadi kesalahan. {error}',
  },
};

const EMOJI_MAP: Record<MessageIntent, string> = {
  WELCOME: '👋',
  ONBOARDING_STYLE: '🎨',
  ONBOARDING_EMOJI: '😊',
  ONBOARDING_COMPLETE: '✅',
  REMINDER: '⏰',
  VERIFY_SUCCESS: '✅',
  VERIFY_FAILED: '❌',
  SETTINGS_UPDATED: '⚙️',
  TRANSACTION_ADDED: '💰',
  BALANCE: '💵',
  ERROR: '⚠️',
};

export class FormatReplyService {
  formatMessage(user: User, intent: MessageIntent, payload: MessagePayload = {}): string {
    const style = user.bot_style || 'santai';
    const useEmoji = user.use_emoji ?? true;

    let template = TEMPLATES[intent]?.[style] || TEMPLATES[intent]?.santai || '';

    // Replace placeholders
    template = template.replace('{name}', payload.name || user.full_name || 'Juragan');
    template = template.replace('{amount}', this.formatNumber(payload.amount || 0));
    template = template.replace('{balance}', this.formatNumber(payload.balance || 0));
    template = template.replace('{setting}', payload.setting || '');
    template = template.replace('{value}', payload.value || '');
    template = template.replace('{error}', payload.error || 'Silakan coba lagi.');

    // Add emoji if enabled
    if (useEmoji && EMOJI_MAP[intent]) {
      template = `${EMOJI_MAP[intent]} ${template}`;
    }

    return template;
  }

  private formatNumber(num: number): string {
    return num.toLocaleString('id-ID');
  }

  formatReminderMessage(user: User): string {
    return this.formatMessage(user, 'REMINDER', { name: user.full_name });
  }

  formatOnboardingStylePrompt(user: User): string {
    return this.formatMessage(user, 'ONBOARDING_STYLE');
  }

  formatOnboardingEmojiPrompt(user: User): string {
    return this.formatMessage(user, 'ONBOARDING_EMOJI');
  }

  formatOnboardingComplete(user: User): string {
    return this.formatMessage(user, 'ONBOARDING_COMPLETE');
  }

  formatVerifySuccess(user: User): string {
    return this.formatMessage(user, 'VERIFY_SUCCESS');
  }

  formatVerifyFailed(user: User, error: string): string {
    return this.formatMessage(user, 'VERIFY_FAILED', { error });
  }

  formatSettingsUpdated(user: User, setting: string, value: string): string {
    return this.formatMessage(user, 'SETTINGS_UPDATED', { setting, value });
  }

  formatWelcome(user: User): string {
    return this.formatMessage(user, 'WELCOME', { name: user.full_name });
  }
}

export const formatReplyService = new FormatReplyService();
