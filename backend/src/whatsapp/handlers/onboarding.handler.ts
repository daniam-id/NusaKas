import { WASocket } from '@whiskeysockets/baileys';
import { userHandler, getOnboardingState, setOnboardingState, type UserRecord } from './user.handler.js';
import { registrationService } from '../../services/registration.service.js';
import { formatReplyService } from '../../services/format-reply.service.js';
import type { BotStyle, User } from '../../types/index.js';

const STYLE_MAP: Record<number, BotStyle> = {
  1: 'formal',
  2: 'santai',
  3: 'semi-formal',
};

class OnboardingHandler {
  async handleVerifyOTP(
    sock: WASocket,
    jid: string,
    waNumber: string,
    otpCode: string
  ): Promise<{ success: boolean; user?: UserRecord }> {
    const result = await registrationService.verifyOTP(waNumber, otpCode);

    if (!result.success) {
      await sock.sendMessage(jid, {
        text: `❌ ${result.message}`,
      });
      return { success: false };
    }

    // Get user record
    const user = await userHandler.getUser(waNumber);
    if (!user) {
      await sock.sendMessage(jid, {
        text: '❌ Gagal mengambil data user. Silakan coba lagi.',
      });
      return { success: false };
    }

    // Send success message
    await sock.sendMessage(jid, {
      text: `✅ ${result.message}`,
    });

    // Check if onboarding is needed
    if (!user.onboarding_complete) {
      await this.startOnboarding(sock, jid, waNumber, user);
    }

    return { success: true, user };
  }

  async startOnboarding(
    sock: WASocket,
    jid: string,
    waNumber: string,
    user: UserRecord
  ): Promise<void> {
    setOnboardingState(waNumber, 'awaiting_style');

    const message = formatReplyService.formatOnboardingStylePrompt(user as User);
    await sock.sendMessage(jid, { text: message });
  }

  async handleStyleChoice(
    sock: WASocket,
    jid: string,
    waNumber: string,
    choice: number
  ): Promise<boolean> {
    const state = getOnboardingState(waNumber);
    if (state !== 'awaiting_style') {
      return false; // Not in style selection state
    }

    const style = STYLE_MAP[choice];
    if (!style) {
      await sock.sendMessage(jid, {
        text: '❌ Pilihan tidak valid. Silakan pilih 1, 2, atau 3.',
      });
      return true; // Handled but invalid
    }

    // Save style preference
    await userHandler.updateUserSettings(waNumber, { bot_style: style });

    // Move to emoji selection
    setOnboardingState(waNumber, 'awaiting_emoji');

    const user = await userHandler.getUser(waNumber);
    if (user) {
      user.bot_style = style; // Update local copy for formatting
      const message = formatReplyService.formatOnboardingEmojiPrompt(user as User);
      await sock.sendMessage(jid, { text: message });
    }

    return true;
  }

  async handleEmojiChoice(
    sock: WASocket,
    jid: string,
    waNumber: string,
    choice: boolean
  ): Promise<boolean> {
    const state = getOnboardingState(waNumber);
    if (state !== 'awaiting_emoji') {
      return false; // Not in emoji selection state
    }

    // Save emoji preference and mark onboarding complete
    await userHandler.updateUserSettings(waNumber, {
      use_emoji: choice,
      onboarding_complete: true,
    });

    // Clear onboarding state
    setOnboardingState(waNumber, 'none');

    // Send completion message
    const user = await userHandler.getUser(waNumber);
    if (user) {
      user.use_emoji = choice; // Update local copy for formatting
      const message = formatReplyService.formatOnboardingComplete(user as User);
      await sock.sendMessage(jid, { text: message });
    }

    return true;
  }

  isInOnboarding(waNumber: string): boolean {
    return getOnboardingState(waNumber) !== 'none';
  }
}

export const onboardingHandler = new OnboardingHandler();
