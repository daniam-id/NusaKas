import { vi } from 'vitest';

export interface MockMessage {
  jid: string;
  text: string;
  timestamp: Date;
}

export interface MockWASocket {
  sendMessage: ReturnType<typeof vi.fn>;
  _sentMessages: MockMessage[];
  _clearMessages: () => void;
  _getLastMessage: () => MockMessage | undefined;
  _getMessagesTo: (jid: string) => MockMessage[];
}

export function createMockWASocket(): MockWASocket {
  const sentMessages: MockMessage[] = [];

  const sendMessage = vi.fn().mockImplementation(async (jid: string, content: { text: string }) => {
    sentMessages.push({
      jid,
      text: content.text,
      timestamp: new Date(),
    });
    return { status: 1 };
  });

  return {
    sendMessage,
    _sentMessages: sentMessages,
    _clearMessages: () => {
      sentMessages.length = 0;
    },
    _getLastMessage: () => sentMessages[sentMessages.length - 1],
    _getMessagesTo: (jid: string) => sentMessages.filter(m => m.jid === jid),
  };
}

export function createMockJid(waNumber: string): string {
  const normalized = waNumber.replace(/\D/g, '');
  return `${normalized}@s.whatsapp.net`;
}

export function extractTextFromMockMessages(messages: MockMessage[]): string[] {
  return messages.map(m => m.text);
}

export function findMessageContaining(messages: MockMessage[], text: string): MockMessage | undefined {
  return messages.find(m => m.text.toLowerCase().includes(text.toLowerCase()));
}

export function assertMessageSent(socket: MockWASocket, jid: string, containsText: string): void {
  const messages = socket._getMessagesTo(jid);
  const found = messages.some(m => m.text.includes(containsText));
  if (!found) {
    throw new Error(
      `Expected message containing "${containsText}" to be sent to ${jid}. ` +
      `Sent messages: ${messages.map(m => m.text.substring(0, 50)).join(', ')}`
    );
  }
}

export function assertNoMessageSent(socket: MockWASocket, jid: string): void {
  const messages = socket._getMessagesTo(jid);
  if (messages.length > 0) {
    throw new Error(
      `Expected no messages to ${jid}, but found ${messages.length} messages`
    );
  }
}

export const mockSessionManager = {
  getOrCreateSession: vi.fn(),
  getSession: vi.fn(),
  getSessionByPhone: vi.fn(),
  updateProgress: vi.fn(),
  updateSessionData: vi.fn(),
  completeSession: vi.fn(),
  isDataComplete: vi.fn(),
  getNextMissingField: vi.fn(),
  hasActiveSession: vi.fn(),
  expireSession: vi.fn(),
};

export const mockWebRegistrationFlow = {
  generateOTP: vi.fn(),
  validateOTP: vi.fn(),
  startWebRegistration: vi.fn(),
};

export function resetAllMocks(): void {
  Object.values(mockSessionManager).forEach(mock => {
    if (typeof mock.mockReset === 'function') {
      mock.mockReset();
    }
  });
  Object.values(mockWebRegistrationFlow).forEach(mock => {
    if (typeof mock.mockReset === 'function') {
      mock.mockReset();
    }
  });
}
