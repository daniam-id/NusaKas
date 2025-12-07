import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockWASocket,
  createMockJid,
  assertMessageSent,
  resetAllMocks,
  type MockWASocket,
} from '../mocks/whatsapp-mock.js';

vi.mock('../../src/config/supabase.js', () => ({
  getSupabase: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  })),
}));

vi.mock('../../src/config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-secret-key',
    FRONTEND_URL: 'https://test.nusakas.id',
    WHATSAPP_BOT_NUMBER: '6281234567890',
  },
}));

vi.mock('../../src/services/session-manager.js', () => ({
  sessionManager: {
    getOrCreateSession: vi.fn().mockResolvedValue({
      session_id: 'test-session-id',
      is_new: true,
      current_step: 'options',
      collected_data: {},
    }),
    getSession: vi.fn().mockResolvedValue(null),
    getSessionByPhone: vi.fn().mockResolvedValue(null),
    updateProgress: vi.fn().mockResolvedValue(true),
    updateSessionData: vi.fn().mockResolvedValue(true),
    completeSession: vi.fn().mockResolvedValue({
      success: true,
      user_id: 'test-user-id',
      error_message: null,
    }),
    isDataComplete: vi.fn().mockResolvedValue(false),
    getNextMissingField: vi.fn().mockResolvedValue('store_name'),
    hasActiveSession: vi.fn().mockResolvedValue(false),
    expireSession: vi.fn().mockResolvedValue(true),
    syncFromPlatform: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../../src/services/web-registration.js', () => ({
  webRegistrationFlow: {
    generateOTP: vi.fn().mockResolvedValue({
      otp_id: 'test-otp-id',
      otp_code: '123456',
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      verification_link: 'https://test.nusakas.id/verify?otp=123456&phone=6281234567890',
    }),
    validateOTP: vi.fn().mockResolvedValue({
      is_valid: true,
      otp_id: 'test-otp-id',
      session_id: 'test-session-id',
      error_message: null,
    }),
  },
}));

import {
  registrationRouter,
  getRegistrationState,
  setRegistrationState,
} from '../../src/whatsapp/handlers/registration-router.js';
import { whatsappRegistrationFlow } from '../../src/whatsapp/handlers/whatsapp-registration.js';
import { sessionManager } from '../../src/services/session-manager.js';

describe('WhatsApp Registration Flow Integration', () => {
  let mockSocket: MockWASocket;
  const testWaNumber = '081234567890';
  const testJid = createMockJid(testWaNumber);

  beforeEach(() => {
    mockSocket = createMockWASocket();
    setRegistrationState(testWaNumber, 'none');
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockSocket._clearMessages();
    resetAllMocks();
  });

  describe('First-Time User Detection', () => {
    it('should detect first-time user and present options', async () => {
      vi.mocked(sessionManager.hasActiveSession).mockResolvedValue(false);

      const handled = await registrationRouter.handleFirstMessage(
        mockSocket as any,
        testJid,
        testWaNumber
      );

      expect(handled).toBe(true);
      expect(mockSocket.sendMessage).toHaveBeenCalled();
      
      const lastMessage = mockSocket._getLastMessage();
      expect(lastMessage?.text).toContain('Selamat datang');
      expect(lastMessage?.text).toContain('1');
      expect(lastMessage?.text).toContain('2');
    });

    it('should set registration state to awaiting_option after presenting options', async () => {
      await registrationRouter.presentOptions(mockSocket as any, testJid, testWaNumber);

      const state = getRegistrationState(testWaNumber);
      expect(state).toBe('awaiting_option');
    });
  });

  describe('Option Selection', () => {
    beforeEach(async () => {
      setRegistrationState(testWaNumber, 'awaiting_option');
    });

    it('should handle WhatsApp registration selection (option 1)', async () => {
      const handled = await registrationRouter.handleOptionSelection(
        mockSocket as any,
        testJid,
        testWaNumber,
        '1'
      );

      expect(handled).toBe(true);
      const lastMessage = mockSocket._getLastMessage();
      expect(lastMessage?.text).toContain('WhatsApp');
      expect(lastMessage?.text).toContain('Pertanyaan');
    });

    it('should handle Web registration selection (option 2)', async () => {
      const handled = await registrationRouter.handleOptionSelection(
        mockSocket as any,
        testJid,
        testWaNumber,
        '2'
      );

      expect(handled).toBe(true);
      const lastMessage = mockSocket._getLastMessage();
      expect(lastMessage?.text).toContain('Website');
      expect(lastMessage?.text).toContain('link');
    });

    it('should reject invalid option and prompt again', async () => {
      const handled = await registrationRouter.handleOptionSelection(
        mockSocket as any,
        testJid,
        testWaNumber,
        '3'
      );

      expect(handled).toBe(true);
      const lastMessage = mockSocket._getLastMessage();
      expect(lastMessage?.text).toContain('1');
      expect(lastMessage?.text).toContain('2');
    });

    it('should not handle selection when not in awaiting_option state', async () => {
      setRegistrationState(testWaNumber, 'none');

      const handled = await registrationRouter.handleOptionSelection(
        mockSocket as any,
        testJid,
        testWaNumber,
        '1'
      );

      expect(handled).toBe(false);
    });
  });

  describe('WhatsApp Data Collection Flow', () => {
    beforeEach(() => {
      setRegistrationState(testWaNumber, 'data_collection');
      vi.mocked(sessionManager.getSessionByPhone).mockResolvedValue({
        id: 'test-session-id',
        wa_number: '6281234567890',
        source_platform: 'whatsapp',
        current_step: 'data_collection',
        collected_data: {},
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });
    });

    it('should collect store name as first field', async () => {
      vi.mocked(sessionManager.getNextMissingField).mockResolvedValue('store_name');

      const handled = await whatsappRegistrationFlow.handleDataInput(
        mockSocket as any,
        testJid,
        testWaNumber,
        'Toko Sembako Makmur'
      );

      expect(handled).toBe(true);
      expect(sessionManager.updateSessionData).toHaveBeenCalledWith(
        'test-session-id',
        expect.objectContaining({ store_name: 'Toko Sembako Makmur' })
      );
    });

    it('should collect owner name as second field', async () => {
      vi.mocked(sessionManager.getSessionByPhone).mockResolvedValue({
        id: 'test-session-id',
        wa_number: '6281234567890',
        source_platform: 'whatsapp',
        current_step: 'data_collection',
        collected_data: { store_name: 'Toko Makmur' },
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      const handled = await whatsappRegistrationFlow.handleDataInput(
        mockSocket as any,
        testJid,
        testWaNumber,
        'Budi Santoso'
      );

      expect(handled).toBe(true);
      expect(sessionManager.updateSessionData).toHaveBeenCalled();
    });

    it('should collect and hash PIN as third field', async () => {
      vi.mocked(sessionManager.getSessionByPhone).mockResolvedValue({
        id: 'test-session-id',
        wa_number: '6281234567890',
        source_platform: 'whatsapp',
        current_step: 'data_collection',
        collected_data: { store_name: 'Toko Makmur', owner_name: 'Budi' },
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      const handled = await whatsappRegistrationFlow.handleDataInput(
        mockSocket as any,
        testJid,
        testWaNumber,
        '123789'
      );

      expect(handled).toBe(true);
      expect(sessionManager.updateSessionData).toHaveBeenCalledWith(
        'test-session-id',
        expect.objectContaining({
          pin_hash: expect.stringMatching(/^\$2[aby]?\$/)
        })
      );
    });

    it('should reject invalid store name and re-prompt', async () => {
      const handled = await whatsappRegistrationFlow.handleDataInput(
        mockSocket as any,
        testJid,
        testWaNumber,
        'AB'
      );

      expect(handled).toBe(true);
      const lastMessage = mockSocket._getLastMessage();
      expect(lastMessage?.text).toContain('tidak valid');
      expect(lastMessage?.text).toContain('minimal');
    });

    it('should reject invalid PIN format', async () => {
      vi.mocked(sessionManager.getSessionByPhone).mockResolvedValue({
        id: 'test-session-id',
        wa_number: '6281234567890',
        source_platform: 'whatsapp',
        current_step: 'data_collection',
        collected_data: { store_name: 'Toko Makmur', owner_name: 'Budi' },
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      const handled = await whatsappRegistrationFlow.handleDataInput(
        mockSocket as any,
        testJid,
        testWaNumber,
        '12345'
      );

      expect(handled).toBe(true);
      const lastMessage = mockSocket._getLastMessage();
      expect(lastMessage?.text).toContain('tidak valid');
    });

    it('should reject sequential PIN', async () => {
      vi.mocked(sessionManager.getSessionByPhone).mockResolvedValue({
        id: 'test-session-id',
        wa_number: '6281234567890',
        source_platform: 'whatsapp',
        current_step: 'data_collection',
        collected_data: { store_name: 'Toko Makmur', owner_name: 'Budi' },
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      const handled = await whatsappRegistrationFlow.handleDataInput(
        mockSocket as any,
        testJid,
        testWaNumber,
        '123456'
      );

      expect(handled).toBe(true);
      const lastMessage = mockSocket._getLastMessage();
      expect(lastMessage?.text).toContain('tidak valid');
    });
  });

  describe('Registration Completion', () => {
    it('should complete registration when all data collected', async () => {
      setRegistrationState(testWaNumber, 'data_collection');
      
      vi.mocked(sessionManager.getSessionByPhone).mockResolvedValue({
        id: 'test-session-id',
        wa_number: '6281234567890',
        source_platform: 'whatsapp',
        current_step: 'data_collection',
        collected_data: {
          store_name: 'Toko Makmur',
          owner_name: 'Budi Santoso',
          pin_hash: '$2b$10$hashedpin',
        },
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      vi.mocked(sessionManager.getSession).mockResolvedValue({
        id: 'test-session-id',
        wa_number: '6281234567890',
        source_platform: 'whatsapp',
        current_step: 'completed',
        collected_data: {
          store_name: 'Toko Makmur',
          owner_name: 'Budi Santoso',
          pin_hash: '$2b$10$hashedpin',
        },
        status: 'completed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      const handled = await whatsappRegistrationFlow.handleDataInput(
        mockSocket as any,
        testJid,
        testWaNumber,
        '947382'
      );

      expect(handled).toBe(true);
    });

    it('should send success message after completion', async () => {
      setRegistrationState(testWaNumber, 'data_collection');
      
      vi.mocked(sessionManager.getSessionByPhone).mockResolvedValue({
        id: 'test-session-id',
        wa_number: '6281234567890',
        source_platform: 'whatsapp',
        current_step: 'data_collection',
        collected_data: {
          store_name: 'Toko Makmur',
          owner_name: 'Budi',
          pin_hash: '$2b$10$hash',
        },
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      vi.mocked(sessionManager.getSession).mockResolvedValue({
        id: 'test-session-id',
        wa_number: '6281234567890',
        source_platform: 'whatsapp',
        current_step: 'completed',
        collected_data: {
          store_name: 'Toko Makmur',
          owner_name: 'Budi',
          pin_hash: '$2b$10$hash',
        },
        status: 'completed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      await whatsappRegistrationFlow.handleDataInput(
        mockSocket as any,
        testJid,
        testWaNumber,
        '984756'
      );

      const messages = mockSocket._getMessagesTo(testJid);
      const successMessage = messages.find(m => 
        m.text.includes('Berhasil') || m.text.includes('berhasil')
      );
      expect(successMessage).toBeDefined();
    });
  });

  describe('Session Expiry Handling', () => {
    it('should handle expired session gracefully', async () => {
      setRegistrationState(testWaNumber, 'data_collection');
      vi.mocked(sessionManager.getSessionByPhone).mockResolvedValue(null);

      const handled = await whatsappRegistrationFlow.handleDataInput(
        mockSocket as any,
        testJid,
        testWaNumber,
        'Toko Makmur'
      );

      expect(handled).toBe(true);
      const lastMessage = mockSocket._getLastMessage();
      expect(lastMessage?.text).toContain('expired');
    });
  });

  describe('Registration Restart', () => {
    it('should allow restart with ULANG command', async () => {
      setRegistrationState(testWaNumber, 'data_collection');

      const handled = await registrationRouter.handleRestartRequest(
        mockSocket as any,
        testJid,
        testWaNumber
      );

      expect(handled).toBe(true);
      const lastMessage = mockSocket._getLastMessage();
      expect(lastMessage?.text).toContain('Selamat datang');
    });
  });

  describe('State Management', () => {
    it('should correctly track registration state', () => {
      expect(getRegistrationState(testWaNumber)).toBe('none');

      setRegistrationState(testWaNumber, 'awaiting_option');
      expect(getRegistrationState(testWaNumber)).toBe('awaiting_option');

      setRegistrationState(testWaNumber, 'data_collection');
      expect(getRegistrationState(testWaNumber)).toBe('data_collection');

      setRegistrationState(testWaNumber, 'none');
      expect(getRegistrationState(testWaNumber)).toBe('none');
    });

    it('should not interfere with other users', () => {
      const otherNumber = '089876543210';
      
      setRegistrationState(testWaNumber, 'data_collection');
      setRegistrationState(otherNumber, 'awaiting_option');

      expect(getRegistrationState(testWaNumber)).toBe('data_collection');
      expect(getRegistrationState(otherNumber)).toBe('awaiting_option');
    });
  });

  describe('Message Content Validation', () => {
    it('should include proper Indonesian language in welcome message', async () => {
      await registrationRouter.presentOptions(mockSocket as any, testJid, testWaNumber);

      const lastMessage = mockSocket._getLastMessage();
      expect(lastMessage?.text).toContain('WhatsApp');
      expect(lastMessage?.text).toContain('Website');
    });

    it('should include question numbers in data collection prompts', async () => {
      setRegistrationState(testWaNumber, 'data_collection');
      
      await whatsappRegistrationFlow.promptForField(
        mockSocket as any,
        testJid,
        'store_name',
        1
      );

      const lastMessage = mockSocket._getLastMessage();
      expect(lastMessage?.text).toContain('1/3');
    });
  });
});
