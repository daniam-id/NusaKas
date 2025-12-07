import { WASocket } from 'baileys';
import { sessionManager } from '../../services/session-manager.js';
import { getRegistrationState, setRegistrationState } from './registration-router.js';
import type { RegistrationCollectedData, ValidationResult } from '../../types/index.js';
import bcrypt from 'bcrypt';

type DataCollectionField = 'store_name' | 'owner_name' | 'pin_hash';

const FIELD_ORDER: DataCollectionField[] = ['store_name', 'owner_name', 'pin_hash'];

const FIELD_PROMPTS: Record<DataCollectionField, { question: string; example: string }> = {
  store_name: {
    question: 'Apa nama toko atau usaha Anda?',
    example: 'Contoh: Toko Sembako Makmur, Warung Makan Bu Ani',
  },
  owner_name: {
    question: 'Siapa nama pemilik toko?',
    example: 'Nama lengkap Anda sebagai pemilik usaha',
  },
  pin_hash: {
    question: 'Buat PIN 6 digit untuk keamanan akun:',
    example: 'PIN akan digunakan untuk login di website',
  },
};

class WhatsAppRegistrationFlow {
  async handleDataInput(
    sock: WASocket,
    jid: string,
    waNumber: string,
    input: string
  ): Promise<boolean> {
    const state = getRegistrationState(waNumber);
    
    if (state !== 'data_collection') {
      return false;
    }

    const session = await sessionManager.getSessionByPhone(waNumber);
    if (!session) {
      await this.handleSessionExpired(sock, jid);
      return true;
    }

    const currentField = this.getCurrentField(session.collected_data);
    if (!currentField) {
      await this.completeDataCollection(sock, jid, waNumber, session.id);
      return true;
    }

    const validation = this.validateInput(currentField, input);
    if (!validation.valid) {
      await this.sendValidationError(sock, jid, currentField, validation.errors);
      return true;
    }

    const processedValue = await this.processFieldValue(currentField, input);
    
    await sessionManager.updateSessionData(session.id, {
      [currentField]: processedValue,
    });

    const nextField = this.getNextField(currentField);
    
    if (nextField) {
      await this.promptForField(sock, jid, nextField, this.getCompletedCount(session.collected_data) + 1);
    } else {
      await this.completeDataCollection(sock, jid, waNumber, session.id);
    }

    return true;
  }

  private getCurrentField(data: RegistrationCollectedData): DataCollectionField | null {
    for (const field of FIELD_ORDER) {
      if (!data[field]) {
        return field;
      }
    }
    return null;
  }

  private getNextField(currentField: DataCollectionField): DataCollectionField | null {
    const currentIndex = FIELD_ORDER.indexOf(currentField);
    if (currentIndex === -1 || currentIndex >= FIELD_ORDER.length - 1) {
      return null;
    }
    return FIELD_ORDER[currentIndex + 1];
  }

  private getCompletedCount(data: RegistrationCollectedData): number {
    return FIELD_ORDER.filter(field => !!data[field]).length;
  }

  private validateInput(field: DataCollectionField, input: string): ValidationResult {
    const trimmed = input.trim();
    const errors: string[] = [];

    switch (field) {
      case 'store_name':
        if (trimmed.length < 3) {
          errors.push('Nama toko minimal 3 karakter');
        }
        if (trimmed.length > 100) {
          errors.push('Nama toko maksimal 100 karakter');
        }
        if (/^\d+$/.test(trimmed)) {
          errors.push('Nama toko tidak boleh hanya angka');
        }
        break;

      case 'owner_name':
        if (trimmed.length < 2) {
          errors.push('Nama pemilik minimal 2 karakter');
        }
        if (trimmed.length > 100) {
          errors.push('Nama pemilik maksimal 100 karakter');
        }
        if (/^\d+$/.test(trimmed)) {
          errors.push('Nama pemilik tidak boleh hanya angka');
        }
        break;

      case 'pin_hash':
        if (!/^\d{6}$/.test(trimmed)) {
          errors.push('PIN harus 6 digit angka');
        }
        if (/^(\d)\1{5}$/.test(trimmed)) {
          errors.push('PIN tidak boleh angka berulang (contoh: 111111)');
        }
        if (/^(012345|123456|234567|345678|456789|567890|987654|876543|765432|654321|543210)$/.test(trimmed)) {
          errors.push('PIN tidak boleh angka berurutan');
        }
        break;
    }

    return { valid: errors.length === 0, errors };
  }

  private async processFieldValue(field: DataCollectionField, input: string): Promise<string> {
    const trimmed = input.trim();

    if (field === 'pin_hash') {
      return bcrypt.hashSync(trimmed, 10);
    }

    return trimmed;
  }

  async promptForField(
    sock: WASocket,
    jid: string,
    field: DataCollectionField,
    questionNumber: number
  ): Promise<void> {
    const prompt = FIELD_PROMPTS[field];
    
    const message = `📝 *Pertanyaan ${questionNumber}/3*
${prompt.question}

_(${prompt.example})_`;

    await sock.sendMessage(jid, { text: message });
  }

  private async sendValidationError(
    sock: WASocket,
    jid: string,
    field: DataCollectionField,
    errors: string[]
  ): Promise<void> {
    const prompt = FIELD_PROMPTS[field];
    const errorList = errors.map(e => `• ${e}`).join('\n');

    const message = `❌ *Input tidak valid*

${errorList}

Silakan masukkan ulang:
${prompt.question}

_(${prompt.example})_`;

    await sock.sendMessage(jid, { text: message });
  }

  private async completeDataCollection(
    sock: WASocket,
    jid: string,
    waNumber: string,
    sessionId: string
  ): Promise<void> {
    await sock.sendMessage(jid, {
      text: '⏳ Memproses pendaftaran...',
    });

    const result = await sessionManager.completeSession(sessionId);

    if (!result.success) {
      await sock.sendMessage(jid, {
        text: `❌ Gagal menyelesaikan pendaftaran: ${result.error_message}\n\nKetik *ULANG* untuk mencoba lagi.`,
      });
      return;
    }

    setRegistrationState(waNumber, 'none');

    const session = await sessionManager.getSession(sessionId);
    const storeName = session?.collected_data?.store_name || 'Toko Anda';
    const ownerName = session?.collected_data?.owner_name || 'Juragan';

    const message = `🎉 *Pendaftaran Berhasil!*

Selamat datang di NusaKas, ${ownerName}!

📋 *Data Toko Anda:*
• Nama Toko: ${storeName}
• Pemilik: ${ownerName}
• WhatsApp: ${waNumber}

✅ Akun Anda sudah aktif dan siap digunakan.

*Cara Pakai NusaKas:*
📝 Catat pemasukan: "masuk 50rb jual sayur"
📝 Catat pengeluaran: "keluar 20rb beli bensin"
📊 Cek saldo: "saldo"
📄 Laporan: "laporan" atau "download pdf"

Mulai catat keuangan usaha Anda sekarang! 💪`;

    await sock.sendMessage(jid, { text: message });
  }

  private async handleSessionExpired(sock: WASocket, jid: string): Promise<void> {
    await sock.sendMessage(jid, {
      text: `⏰ *Sesi pendaftaran expired*

Sesi pendaftaran Anda sudah berakhir karena tidak ada aktivitas.

Ketik *DAFTAR* untuk memulai pendaftaran baru.`,
    });
  }

  async startDataCollection(sock: WASocket, jid: string, waNumber: string): Promise<void> {
    const session = await sessionManager.getSessionByPhone(waNumber);
    
    if (!session) {
      await this.handleSessionExpired(sock, jid);
      return;
    }

    await sessionManager.updateProgress(session.id, 'data_collection');
    setRegistrationState(waNumber, 'data_collection');

    const currentField = this.getCurrentField(session.collected_data);
    const completedCount = this.getCompletedCount(session.collected_data);

    if (currentField) {
      const message = `✅ *Pendaftaran via WhatsApp*

Saya akan mengajukan beberapa pertanyaan untuk melengkapi profil Anda.

`;
      await sock.sendMessage(jid, { text: message });
      await this.promptForField(sock, jid, currentField, completedCount + 1);
    } else {
      await this.completeDataCollection(sock, jid, waNumber, session.id);
    }
  }

  async resumeDataCollection(sock: WASocket, jid: string, waNumber: string): Promise<boolean> {
    const session = await sessionManager.getSessionByPhone(waNumber);
    
    if (!session) {
      return false;
    }

    const currentField = this.getCurrentField(session.collected_data);
    
    if (!currentField) {
      await this.completeDataCollection(sock, jid, waNumber, session.id);
      return true;
    }

    const completedCount = this.getCompletedCount(session.collected_data);

    await sock.sendMessage(jid, {
      text: `📋 *Melanjutkan Pendaftaran*

Anda sudah mengisi ${completedCount} dari 3 data yang diperlukan.
Mari lanjutkan...

`,
    });

    await this.promptForField(sock, jid, currentField, completedCount + 1);
    return true;
  }

  isInDataCollection(waNumber: string): boolean {
    return getRegistrationState(waNumber) === 'data_collection';
  }
}

export const whatsappRegistrationFlow = new WhatsAppRegistrationFlow();
