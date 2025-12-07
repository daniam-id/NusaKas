import { WASocket } from 'baileys';
import { getSupabase } from '../../config/supabase.js';
import { sessionManager } from '../../services/session-manager.js';
import { env } from '../../config/env.js';
import type { RegistrationSession } from '../../types/index.js';

type RegistrationFlowState = 'none' | 'awaiting_option' | 'data_collection' | 'verification';

const registrationStates = new Map<string, RegistrationFlowState>();

export function getRegistrationState(waNumber: string): RegistrationFlowState {
  return registrationStates.get(normalizePhone(waNumber)) || 'none';
}

export function setRegistrationState(waNumber: string, state: RegistrationFlowState): void {
  const normalized = normalizePhone(waNumber);
  if (state === 'none') {
    registrationStates.delete(normalized);
  } else {
    registrationStates.set(normalized, state);
  }
}

function normalizePhone(waNumber: string): string {
  let normalized = waNumber.replace(/\D/g, '');
  if (normalized.startsWith('0')) {
    normalized = '62' + normalized.slice(1);
  }
  if (!normalized.startsWith('62')) {
    normalized = '62' + normalized;
  }
  return normalized;
}

class RegistrationFlowRouter {
  async isFirstTimeUser(waNumber: string): Promise<boolean> {
    const supabase = getSupabase();
    const normalized = normalizePhone(waNumber);

    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('wa_number', normalized)
      .single();

    return !data;
  }

  async hasActiveRegistration(waNumber: string): Promise<boolean> {
    return sessionManager.hasActiveSession(waNumber);
  }

  async handleFirstMessage(sock: WASocket, jid: string, waNumber: string): Promise<boolean> {
    const isFirstTime = await this.isFirstTimeUser(waNumber);
    
    if (!isFirstTime) {
      return false;
    }

    const hasActiveReg = await this.hasActiveRegistration(waNumber);
    
    if (hasActiveReg) {
      const session = await sessionManager.getSessionByPhone(waNumber);
      if (session) {
        return this.resumeRegistration(sock, jid, waNumber, session);
      }
    }

    await this.presentOptions(sock, jid, waNumber);
    return true;
  }

  async presentOptions(sock: WASocket, jid: string, waNumber: string): Promise<void> {
    const { session_id } = await sessionManager.getOrCreateSession(waNumber, 'whatsapp');
    
    setRegistrationState(waNumber, 'awaiting_option');

    const message = `🎉 *Selamat datang di NusaKas!*

Aplikasi pencatatan keuangan UMKM via WhatsApp.

Silakan pilih cara pendaftaran:

*1️⃣ Lanjutkan di WhatsApp*
Daftar langsung di chat ini dengan menjawab beberapa pertanyaan.

*2️⃣ Daftar di Website*
Buka link untuk mengisi formulir pendaftaran di browser.

Balas dengan angka *1* atau *2* untuk memilih.`;

    await sock.sendMessage(jid, { text: message });
    
    console.log(`[Registration] Options presented to ${waNumber}, session: ${session_id}`);
  }

  async handleOptionSelection(
    sock: WASocket,
    jid: string,
    waNumber: string,
    selection: string
  ): Promise<boolean> {
    const state = getRegistrationState(waNumber);
    
    if (state !== 'awaiting_option') {
      return false;
    }

    const trimmed = selection.trim();

    if (trimmed === '1' || trimmed.toLowerCase().includes('whatsapp')) {
      await this.startWhatsAppFlow(sock, jid, waNumber);
      return true;
    }

    if (trimmed === '2' || trimmed.toLowerCase().includes('website') || trimmed.toLowerCase().includes('web')) {
      await this.startWebFlow(sock, jid, waNumber);
      return true;
    }

    await sock.sendMessage(jid, {
      text: '❓ Mohon balas dengan angka *1* (WhatsApp) atau *2* (Website) untuk memilih cara pendaftaran.',
    });

    return true;
  }

  private async startWhatsAppFlow(sock: WASocket, jid: string, waNumber: string): Promise<void> {
    const session = await sessionManager.getSessionByPhone(waNumber);
    
    if (session) {
      await sessionManager.updateProgress(session.id, 'data_collection');
    }

    setRegistrationState(waNumber, 'data_collection');

    const message = `✅ *Pendaftaran via WhatsApp*

Saya akan mengajukan beberapa pertanyaan untuk melengkapi profil Anda.

📝 *Pertanyaan 1/3*
Apa nama toko atau usaha Anda?

_(Contoh: Toko Sembako Makmur, Warung Makan Bu Ani)_`;

    await sock.sendMessage(jid, { text: message });
    
    console.log(`[Registration] WhatsApp flow started for ${waNumber}`);
  }

  private async startWebFlow(sock: WASocket, jid: string, waNumber: string): Promise<void> {
    const session = await sessionManager.getSessionByPhone(waNumber);
    
    if (session) {
      await sessionManager.updateProgress(session.id, 'verification');
    }

    setRegistrationState(waNumber, 'verification');

    const otpCode = this.generateOTP();
    await this.saveOTP(waNumber, otpCode, session?.id);

    const verificationLink = this.buildVerificationLink(waNumber, otpCode);

    const message = `🌐 *Pendaftaran via Website*

Klik link berikut untuk melanjutkan pendaftaran di browser:

${verificationLink}

⏱️ Link berlaku selama *5 menit*.

Atau masukkan kode OTP ini di website:
📟 *${otpCode}*

Setelah selesai di website, Anda bisa langsung menggunakan NusaKas via WhatsApp.`;

    await sock.sendMessage(jid, { text: message });
    
    console.log(`[Registration] Web flow started for ${waNumber}, OTP: ${otpCode}`);
  }

  private async resumeRegistration(
    sock: WASocket,
    jid: string,
    waNumber: string,
    session: RegistrationSession
  ): Promise<boolean> {
    const step = session.current_step;

    switch (step) {
      case 'options':
        await this.presentOptions(sock, jid, waNumber);
        return true;

      case 'data_collection':
        setRegistrationState(waNumber, 'data_collection');
        const nextField = await sessionManager.getNextMissingField(session.id);
        await this.promptForField(sock, jid, nextField, session.collected_data);
        return true;

      case 'verification':
        setRegistrationState(waNumber, 'verification');
        await sock.sendMessage(jid, {
          text: '⏳ Anda memiliki pendaftaran yang belum selesai via website. Silakan selesaikan verifikasi di browser atau ketik *ULANG* untuk memulai dari awal.',
        });
        return true;

      case 'completed':
        setRegistrationState(waNumber, 'none');
        return false;

      default:
        return false;
    }
  }

  private async promptForField(
    sock: WASocket,
    jid: string,
    field: keyof import('../../types/index.js').RegistrationCollectedData | null,
    currentData: import('../../types/index.js').RegistrationCollectedData
  ): Promise<void> {
    if (!field) {
      return;
    }

    const completedCount = [currentData.store_name, currentData.owner_name, currentData.pin_hash]
      .filter(Boolean).length;

    const prompts: Record<string, string> = {
      store_name: `📝 *Pertanyaan ${completedCount + 1}/3*
Apa nama toko atau usaha Anda?

_(Contoh: Toko Sembako Makmur, Warung Makan Bu Ani)_`,
      
      owner_name: `📝 *Pertanyaan ${completedCount + 1}/3*
Siapa nama pemilik toko?

_(Nama lengkap Anda sebagai pemilik usaha)_`,
      
      pin_hash: `📝 *Pertanyaan ${completedCount + 1}/3*
Buat PIN 6 digit untuk keamanan akun:

_(PIN akan digunakan untuk login di website)_`,
    };

    const message = prompts[field] || `Mohon masukkan ${field}:`;
    await sock.sendMessage(jid, { text: message });
  }

  async handleRestartRequest(sock: WASocket, jid: string, waNumber: string): Promise<boolean> {
    const session = await sessionManager.getSessionByPhone(waNumber);
    
    if (session) {
      await sessionManager.expireSession(session.id);
    }

    setRegistrationState(waNumber, 'none');
    await this.presentOptions(sock, jid, waNumber);
    
    return true;
  }

  async cancelRegistration(waNumber: string): Promise<void> {
    const session = await sessionManager.getSessionByPhone(waNumber);
    
    if (session) {
      await sessionManager.expireSession(session.id);
    }

    setRegistrationState(waNumber, 'none');
  }

  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async saveOTP(
    waNumber: string,
    otpCode: string,
    sessionId?: string
  ): Promise<void> {
    const supabase = getSupabase();
    const normalized = normalizePhone(waNumber);

    await supabase.from('otp_verifications').insert({
      wa_number: normalized,
      otp_code: otpCode,
      purpose: 'web_verification',
      source_session: sessionId || null,
      status: 'pending',
    });
  }

  private buildVerificationLink(waNumber: string, otpCode: string): string {
    const baseUrl = env.FRONTEND_URL || 'https://app.nusakas.id';
    const normalized = normalizePhone(waNumber);
    return `${baseUrl}/verify?otp=${otpCode}&phone=${normalized}`;
  }

  isRegistrationCommand(text: string): boolean {
    const lower = text.toLowerCase().trim();
    return (
      lower === '1' ||
      lower === '2' ||
      lower === 'ulang' ||
      lower === 'restart' ||
      lower === 'batal' ||
      lower.includes('daftar')
    );
  }
}

export const registrationRouter = new RegistrationFlowRouter();
