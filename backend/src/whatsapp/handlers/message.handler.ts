import { WASocket, proto } from 'baileys';
import { userHandler, getOnboardingState } from './user.handler.js';
import { transactionHandler } from './transaction.handler.js';
import { commandHandler } from './command.handler.js';
import { reportHandler } from './report.handler.js';
import { onboardingHandler } from './onboarding.handler.js';
import { aiService } from '../../services/ai.service.js';
import { settingsService } from '../../services/settings.service.js';
import { formatReplyService } from '../../services/format-reply.service.js';
import type { User } from '../../types/index.js';

class MessageHandler {
  async handle(sock: WASocket, message: proto.IWebMessageInfo): Promise<void> {
    const jid = message.key.remoteJid;
    if (!jid || jid.endsWith('@g.us')) return; // Skip group messages

    const waNumber = jid.replace('@s.whatsapp.net', '');
    const msgContent = message.message;

    if (!msgContent) return;

    console.log(`[WA] Message from ${waNumber}`);

    try {
      // Ensure user exists (auto-register)
      const user = await userHandler.ensureUser(waNumber, sock, jid);
      if (!user) {
        console.error('[WA] Failed to get/create user');
        return;
      }

      // Check message type
      const imageMessage = msgContent.imageMessage;
      const textMessage = 
        msgContent.conversation ||
        msgContent.extendedTextMessage?.text ||
        (imageMessage?.caption);

      // Handle image message (receipt/proof)
      if (imageMessage) {
        await transactionHandler.handleImage(sock, message, user, textMessage || undefined);
        return;
      }

      // Handle text message
      if (textMessage) {
        await this.handleText(sock, jid, waNumber, user, textMessage);
        return;
      }

    } catch (error) {
      console.error('[WA] Error handling message:', error);
      await sock.sendMessage(jid, {
        text: '❌ Maaf, terjadi kesalahan. Silakan coba lagi.',
      });
    }
  }

  private async handleText(
    sock: WASocket,
    jid: string,
    waNumber: string,
    user: { id: string; wa_number: string; bot_style?: string; use_emoji?: boolean; onboarding_complete?: boolean },
    text: string
  ): Promise<void> {
    // Parse command using AI service
    const intent = await aiService.parseCommand(text);

    console.log(`[WA] Intent: ${intent.intent}`);

    // Handle VERIFY_OTP first (before user check)
    if (intent.intent === 'VERIFY_OTP') {
      await onboardingHandler.handleVerifyOTP(sock, jid, waNumber, intent.otpCode);
      return;
    }

    // Check if user is in onboarding flow
    const onboardingState = getOnboardingState(waNumber);
    if (onboardingState !== 'none') {
      if (intent.intent === 'ONBOARDING_STYLE') {
        const handled = await onboardingHandler.handleStyleChoice(sock, jid, waNumber, intent.choice);
        if (handled) return;
      }
      if (intent.intent === 'ONBOARDING_EMOJI') {
        const handled = await onboardingHandler.handleEmojiChoice(sock, jid, waNumber, intent.choice);
        if (handled) return;
      }
      // If not a valid onboarding response, remind user
      await sock.sendMessage(jid, {
        text: '⏳ Silakan selesaikan pengaturan terlebih dahulu dengan membalas pilihan yang tersedia.',
      });
      return;
    }

    switch (intent.intent) {
      case 'ADD_TRANSACTION':
        await transactionHandler.handleAdd(sock, jid, user, intent.data);
        break;

      case 'ADD_MULTI_TRANSACTION':
        await transactionHandler.handleMultiAdd(sock, jid, user, intent.data);
        break;

      case 'DELETE_TRANSACTION':
        await commandHandler.handleDelete(sock, jid, user, intent.dailyId);
        break;

      case 'EDIT_TRANSACTION':
        await commandHandler.handleEdit(sock, jid, user, intent.dailyId, intent.newAmount, intent.newDescription);
        break;

      case 'GET_BALANCE':
        await reportHandler.handleBalance(sock, jid, user);
        break;

      case 'GET_REPORT':
        if (intent.reportType === 'pdf') {
          await reportHandler.handlePdfDownload(sock, jid, user);
        } else {
          await reportHandler.handleDailyReport(sock, jid, user);
        }
        break;

      case 'SET_REMINDER_TIME':
        await this.handleSetReminderTime(sock, jid, user, intent.time);
        break;

      case 'SET_OPERATIONAL_DAYS':
        await this.handleSetOperationalDays(sock, jid, user, intent.days);
        break;

      case 'ONBOARDING_STYLE':
      case 'ONBOARDING_EMOJI':
        // These are only valid during onboarding, ignore otherwise
        await this.sendHelp(sock, jid);
        break;

      case 'UNKNOWN':
      default:
        await this.sendHelp(sock, jid);
        break;
    }
  }

  private async handleSetReminderTime(
    sock: WASocket,
    jid: string,
    user: { id: string; bot_style?: string; use_emoji?: boolean },
    time: string
  ): Promise<void> {
    try {
      await settingsService.updateSettings(user.id, { reminder_time: time });
      const message = formatReplyService.formatSettingsUpdated(
        user as User,
        'waktu reminder',
        time
      );
      await sock.sendMessage(jid, { text: message });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Gagal update waktu reminder';
      await sock.sendMessage(jid, { text: `❌ ${errMsg}` });
    }
  }

  private async handleSetOperationalDays(
    sock: WASocket,
    jid: string,
    user: { id: string; bot_style?: string; use_emoji?: boolean },
    days: string[]
  ): Promise<void> {
    try {
      await settingsService.updateSettings(user.id, { operational_days: days });
      const dayNames = days.join(', ');
      const message = formatReplyService.formatSettingsUpdated(
        user as User,
        'hari operasional',
        dayNames
      );
      await sock.sendMessage(jid, { text: message });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Gagal update hari operasional';
      await sock.sendMessage(jid, { text: `❌ ${errMsg}` });
    }
  }

  private async sendHelp(sock: WASocket, jid: string): Promise<void> {
    const helpText = `🤖 *NusaKas Bot*

Cara pakai:
📝 *Catat Transaksi*
• "masuk 50rb jual sayur"
• "keluar 20rb beli bensin"
• Kirim foto struk/nota

🗑️ *Hapus Transaksi*
• "hapus #3"
• "batal #2"

📊 *Laporan*
• "saldo" - cek saldo hari ini
• "laporan" - rekap hari ini
• "download pdf" - unduh laporan

Butuh bantuan? Ketik "help"`;

    await sock.sendMessage(jid, { text: helpText });
  }
}

export const messageHandler = new MessageHandler();
