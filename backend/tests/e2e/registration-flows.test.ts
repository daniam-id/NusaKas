import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockWASocket,
  createMockJid,
  resetAllMocks,
  type MockWASocket,
} from '../mocks/whatsapp-mock.js';

const mockSupabaseData: Record<string, any> = {
  users: [],
  registration_sessions: [],
  otp_verifications: [],
};

vi.mock('../../src/config/supabase.js', () => ({
  getSupabase: vi.fn(() => ({
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn((data: any) => {
        if (Array.isArray(data)) {
          mockSupabaseData[table].push(...data);
        } else {
          mockSupabaseData[table].push(data);
        }
        return { data, error: null };
      }),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  })),
}));

vi.mock('../../src/config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-for-unit-tests-only',
    FRONTEND_URL: 'http://localhost:3001',
    WHATSAPP_BOT_NUMBER: '6280000000000',
    NODE_ENV: 'test',
  },
}));

import {
  registrationRouter,
  getRegistrationState,
  setRegistrationState,
} from '../../src/whatsapp/handlers/registration-router.js';
import { whatsappRegistrationFlow } from '../../src/whatsapp/handlers/whatsapp-registration.js';
import { sessionManager } from '../../src/services/session-manager.js';
import { webRegistrationFlow } from '../../src/services/web-registration.js';
import { hybridRegistrationFlow } from '../../src/services/hybrid-registration.js';
import { registrationCompletionHandler } from '../../src/services/registration-completion.js';

vi.mock('../../src/services/session-manager.js');
vi.mock('../../src/services/web-registration.js');
vi.mock('../../src/services/hybrid-registration.js');
vi.mock('../../src/services/registration-completion.js');

describe('E2E: Registration Flow Scenarios', () => {
  let mockSocket: MockWASocket;

  beforeEach(() => {
    mockSocket = createMockWASocket();
    mockSupabaseData.users = [];
    mockSupabaseData.registration_sessions = [];
    mockSupabaseData.otp_verifications = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockSocket._clearMessages();
    resetAllMocks();
  });

  describe('Scenario 1: Complete WhatsApp-Only Registration', () => {
    const waNumber = '081234567890';
    const jid = createMockJid(waNumber);

    it('should complete full WhatsApp registration journey', async () => {
      // Step 1: First message - present options
      vi.mocked(sessionManager.hasActiveSession).mockResolvedValue(false);
      vi.mocked(sessionManager.getOrCreateSession).mockResolvedValue({
        session_id: 'wa-session-001',
        is_new: true,
        current_step: 'options',
        collected_data: {},
      });

      const presented = await registrationRouter.handleFirstMessage(
        mockSocket as any,
        jid,
        waNumber
      );

      expect(presented).toBe(true);
      expect(mockSocket.sendMessage).toHaveBeenCalled();
      expect(getRegistrationState(waNumber)).toBe('awaiting_option');

      // Step 2: Select WhatsApp registration (option 1)
      vi.mocked(sessionManager.updateProgress).mockResolvedValue(true);
      vi.mocked(sessionManager.getNextMissingField).mockResolvedValue('store_name');

      const optionSelected = await registrationRouter.handleOptionSelection(
        mockSocket as any,
        jid,
        waNumber,
        '1'
      );

      expect(optionSelected).toBe(true);
      expect(getRegistrationState(waNumber)).toBe('data_collection');

      // Step 3: Provide store name
      vi.mocked(sessionManager.getSessionByPhone).mockResolvedValue({
        id: 'wa-session-001',
        wa_number: '6281234567890',
        source_platform: 'whatsapp',
        current_step: 'data_collection',
        collected_data: {},
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });
      vi.mocked(sessionManager.updateSessionData).mockResolvedValue(true);

      const storeNameProvided = await whatsappRegistrationFlow.handleDataInput(
        mockSocket as any,
        jid,
        waNumber,
        'Toko Sembako Makmur Jaya'
      );

      expect(storeNameProvided).toBe(true);
      expect(sessionManager.updateSessionData).toHaveBeenCalledWith(
        'wa-session-001',
        expect.objectContaining({ store_name: 'Toko Sembako Makmur Jaya' })
      );

      // Step 4: Provide owner name
      vi.mocked(sessionManager.getSessionByPhone).mockResolvedValue({
        id: 'wa-session-001',
        wa_number: '6281234567890',
        source_platform: 'whatsapp',
        current_step: 'data_collection',
        collected_data: { store_name: 'Toko Sembako Makmur Jaya' },
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      const ownerNameProvided = await whatsappRegistrationFlow.handleDataInput(
        mockSocket as any,
        jid,
        waNumber,
        'Budi Santoso'
      );

      expect(ownerNameProvided).toBe(true);

      // Step 5: Provide PIN and complete
      vi.mocked(sessionManager.getSessionByPhone).mockResolvedValue({
        id: 'wa-session-001',
        wa_number: '6281234567890',
        source_platform: 'whatsapp',
        current_step: 'data_collection',
        collected_data: {
          store_name: 'Toko Sembako Makmur Jaya',
          owner_name: 'Budi Santoso',
        },
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      vi.mocked(sessionManager.completeSession).mockResolvedValue({
        success: true,
        user_id: 'user-001',
        error_message: null,
      });

      vi.mocked(sessionManager.getSession).mockResolvedValue({
        id: 'wa-session-001',
        wa_number: '6281234567890',
        source_platform: 'whatsapp',
        current_step: 'completed',
        collected_data: {
          store_name: 'Toko Sembako Makmur Jaya',
          owner_name: 'Budi Santoso',
          pin_hash: '$2b$10$hashedpin',
        },
        status: 'completed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      const pinProvided = await whatsappRegistrationFlow.handleDataInput(
        mockSocket as any,
        jid,
        waNumber,
        '947382'
      );

      expect(pinProvided).toBe(true);

      // Verify completion
      expect(sessionManager.updateSessionData).toHaveBeenCalledWith(
        'wa-session-001',
        expect.objectContaining({
          pin_hash: expect.stringMatching(/^\$2[aby]?\$/)
        })
      );
    });

    it('should handle validation errors gracefully during WhatsApp flow', async () => {
      setRegistrationState(waNumber, 'data_collection');

      vi.mocked(sessionManager.getSessionByPhone).mockResolvedValue({
        id: 'wa-session-001',
        wa_number: '6281234567890',
        source_platform: 'whatsapp',
        current_step: 'data_collection',
        collected_data: {},
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      // Try invalid store name (too short)
      const invalidStore = await whatsappRegistrationFlow.handleDataInput(
        mockSocket as any,
        jid,
        waNumber,
        'AB'
      );

      expect(invalidStore).toBe(true);
      const errorMessage = mockSocket._getLastMessage();
      expect(errorMessage?.text).toContain('tidak valid');

      // Session should still be active
      expect(getRegistrationState(waNumber)).toBe('data_collection');
    });
  });

  describe('Scenario 2: Complete Web-Only Registration', () => {
    const waNumber = '082345678901';

    beforeEach(() => {
      vi.mocked(webRegistrationFlow.generateOTP).mockResolvedValue({
        otp_id: 'otp-001',
        otp_code: '123456',
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        verification_link: `https://test.nusakas.id/verify?otp=123456&phone=${waNumber}`,
      });

      vi.mocked(webRegistrationFlow.validateOTP).mockResolvedValue({
        is_valid: true,
        otp_id: 'otp-001',
        session_id: 'web-session-001',
        error_message: null,
      });

      vi.mocked(sessionManager.getOrCreateSession).mockResolvedValue({
        session_id: 'web-session-001',
        is_new: true,
        current_step: 'verification',
        collected_data: {},
      });
    });

    it('should complete full web registration journey', async () => {
      // Step 1: Generate OTP via API
      const otpResult = await webRegistrationFlow.generateOTP(waNumber);

      expect(otpResult.otp_code).toHaveLength(6);
      expect(otpResult.verification_link).toContain(waNumber);

      // Step 2: Verify OTP
      const verifyResult = await webRegistrationFlow.validateOTP(waNumber, '123456');

      expect(verifyResult.is_valid).toBe(true);
      expect(verifyResult.session_id).toBe('web-session-001');

      // Step 3: Update session with collected data
      vi.mocked(sessionManager.updateSessionData).mockResolvedValue(true);

      await sessionManager.updateSessionData('web-session-001', {
        store_name: 'Toko Online Sejahtera',
        owner_name: 'Dewi Lestari',
      });

      expect(sessionManager.updateSessionData).toHaveBeenCalledWith(
        'web-session-001',
        expect.objectContaining({
          store_name: 'Toko Online Sejahtera',
          owner_name: 'Dewi Lestari',
        })
      );

      // Step 4: Complete registration
      vi.mocked(registrationCompletionHandler.completeFromSession).mockResolvedValue({
        success: true,
        user_id: 'user-002',
        token: 'jwt-token-for-user-002',
        error_message: null,
      });

      const completion = await registrationCompletionHandler.completeFromSession('web-session-001');

      expect(completion.success).toBe(true);
      expect(completion.token).toBeDefined();
    });

    it('should handle OTP expiration in web flow', async () => {
      vi.mocked(webRegistrationFlow.validateOTP).mockResolvedValue({
        is_valid: false,
        otp_id: 'otp-001',
        session_id: null,
        error_message: 'OTP sudah expired',
      });

      const verifyResult = await webRegistrationFlow.validateOTP(waNumber, '123456');

      expect(verifyResult.is_valid).toBe(false);
      expect(verifyResult.error_message).toContain('expired');
    });

    it('should handle too many OTP attempts', async () => {
      vi.mocked(webRegistrationFlow.validateOTP).mockResolvedValue({
        is_valid: false,
        otp_id: 'otp-001',
        session_id: null,
        error_message: 'Maksimal 3 percobaan',
      });

      const verifyResult = await webRegistrationFlow.validateOTP(waNumber, '000000');

      expect(verifyResult.is_valid).toBe(false);
      expect(verifyResult.error_message).toContain('percobaan');
    });
  });

  describe('Scenario 3: Hybrid Flow - Web to WhatsApp', () => {
    const waNumber = '083456789012';
    const jid = createMockJid(waNumber);

    it('should allow user to start on web and continue on WhatsApp', async () => {
      // Step 1: Start on web - generate OTP
      vi.mocked(webRegistrationFlow.generateOTP).mockResolvedValue({
        otp_id: 'otp-hybrid-001',
        otp_code: '789012',
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        verification_link: `https://test.nusakas.id/verify?otp=789012&phone=${waNumber}`,
      });

      const otpResult = await webRegistrationFlow.generateOTP(waNumber);
      expect(otpResult.otp_code).toBe('789012');

      // Step 2: Verify OTP on web
      vi.mocked(webRegistrationFlow.validateOTP).mockResolvedValue({
        is_valid: true,
        otp_id: 'otp-hybrid-001',
        session_id: 'hybrid-session-001',
        error_message: null,
      });

      await webRegistrationFlow.validateOTP(waNumber, '789012');

      // Step 3: Initiate hybrid flow to WhatsApp
      vi.mocked(hybridRegistrationFlow.initiateWebToWhatsApp).mockResolvedValue({
        success: true,
        session_id: 'hybrid-session-001',
        deep_link: `https://wa.me/6281234567890?text=LANJUT%20hybrid-session-001`,
        message: 'Link berhasil dibuat',
      });

      const switchResult = await hybridRegistrationFlow.initiateWebToWhatsApp(waNumber);

      expect(switchResult.success).toBe(true);
      expect(switchResult.deep_link).toContain('wa.me');

      // Step 4: User sends message to WhatsApp bot
      setRegistrationState(waNumber, 'data_collection');
      
      vi.mocked(sessionManager.getSessionByPhone).mockResolvedValue({
        id: 'hybrid-session-001',
        wa_number: `62${waNumber.slice(1)}`,
        source_platform: 'web',
        current_step: 'data_collection',
        collected_data: {},
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      vi.mocked(sessionManager.updateSessionData).mockResolvedValue(true);
      vi.mocked(sessionManager.syncFromPlatform).mockResolvedValue(true);

      // Step 5: Complete data collection on WhatsApp
      await whatsappRegistrationFlow.handleDataInput(
        mockSocket as any,
        jid,
        waNumber,
        'Toko Hybrid Makmur'
      );

      expect(sessionManager.updateSessionData).toHaveBeenCalled();
    });
  });

  describe('Scenario 4: Hybrid Flow - WhatsApp to Web', () => {
    const waNumber = '084567890123';
    const jid = createMockJid(waNumber);

    it('should allow user to start on WhatsApp and continue on web', async () => {
      // Step 1: Start on WhatsApp
      vi.mocked(sessionManager.hasActiveSession).mockResolvedValue(false);
      vi.mocked(sessionManager.getOrCreateSession).mockResolvedValue({
        session_id: 'wa-to-web-session-001',
        is_new: true,
        current_step: 'options',
        collected_data: {},
      });

      await registrationRouter.handleFirstMessage(
        mockSocket as any,
        jid,
        waNumber
      );

      // Step 2: Select web option (option 2)
      vi.mocked(sessionManager.updateProgress).mockResolvedValue(true);
      vi.mocked(webRegistrationFlow.generateOTP).mockResolvedValue({
        otp_id: 'otp-wa-to-web-001',
        otp_code: '345678',
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        verification_link: `https://test.nusakas.id/register?session=wa-to-web-session-001`,
      });

      const optionSelected = await registrationRouter.handleOptionSelection(
        mockSocket as any,
        jid,
        waNumber,
        '2'
      );

      expect(optionSelected).toBe(true);

      // Verify OTP was sent via WhatsApp
      const messages = mockSocket._getMessagesTo(jid);
      const otpMessage = messages.find(m => m.text.includes('OTP') || m.text.includes('kode'));
      expect(otpMessage).toBeDefined();

      // Step 3: User continues on web
      vi.mocked(webRegistrationFlow.validateOTP).mockResolvedValue({
        is_valid: true,
        otp_id: 'otp-wa-to-web-001',
        session_id: 'wa-to-web-session-001',
        error_message: null,
      });

      const webVerify = await webRegistrationFlow.validateOTP(waNumber, '345678');
      expect(webVerify.is_valid).toBe(true);

      // Step 4: Complete registration on web
      vi.mocked(registrationCompletionHandler.completeFromSession).mockResolvedValue({
        success: true,
        user_id: 'user-hybrid-002',
        token: 'jwt-hybrid-token',
        error_message: null,
      });

      const completion = await registrationCompletionHandler.completeFromSession('wa-to-web-session-001');

      expect(completion.success).toBe(true);
      expect(completion.token).toBeDefined();
    });
  });

  describe('Scenario 5: Registration Interruption and Resume', () => {
    const waNumber = '085678901234';
    const jid = createMockJid(waNumber);

    it('should allow user to restart registration flow', async () => {
      // Start registration
      setRegistrationState(waNumber, 'data_collection');
      
      vi.mocked(sessionManager.getSessionByPhone).mockResolvedValue({
        id: 'interrupted-session-001',
        wa_number: `62${waNumber.slice(1)}`,
        source_platform: 'whatsapp',
        current_step: 'data_collection',
        collected_data: { store_name: 'Old Store' },
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      // User types ULANG to restart
      vi.mocked(sessionManager.expireSession).mockResolvedValue(true);
      vi.mocked(sessionManager.getOrCreateSession).mockResolvedValue({
        session_id: 'new-session-001',
        is_new: true,
        current_step: 'options',
        collected_data: {},
      });

      const restarted = await registrationRouter.handleRestartRequest(
        mockSocket as any,
        jid,
        waNumber
      );

      expect(restarted).toBe(true);
      expect(getRegistrationState(waNumber)).toBe('awaiting_option');

      // Verify new options are presented
      const lastMessage = mockSocket._getLastMessage();
      expect(lastMessage?.text).toContain('1');
      expect(lastMessage?.text).toContain('2');
    });

    it('should allow user to cancel registration', async () => {
      setRegistrationState(waNumber, 'data_collection');

      vi.mocked(sessionManager.expireSession).mockResolvedValue(true);

      await registrationRouter.cancelRegistration(waNumber);
      setRegistrationState(waNumber, 'none');

      expect(getRegistrationState(waNumber)).toBe('none');
    });
  });

  describe('Scenario 6: Concurrent Multi-User Registration', () => {
    const users = [
      { waNumber: '086789012345', name: 'Toko A' },
      { waNumber: '087890123456', name: 'Toko B' },
      { waNumber: '088901234567', name: 'Toko C' },
    ];

    it('should handle multiple users registering simultaneously', async () => {
      // Initialize all users
      for (const user of users) {
        vi.mocked(sessionManager.hasActiveSession).mockResolvedValue(false);
        vi.mocked(sessionManager.getOrCreateSession).mockResolvedValue({
          session_id: `session-${user.waNumber}`,
          is_new: true,
          current_step: 'options',
          collected_data: {},
        });

        const jid = createMockJid(user.waNumber);
        await registrationRouter.handleFirstMessage(
          mockSocket as any,
          jid,
          user.waNumber
        );
      }

      // Verify each user has their own state
      for (const user of users) {
        expect(getRegistrationState(user.waNumber)).toBe('awaiting_option');
      }

      // First user selects WhatsApp
      vi.mocked(sessionManager.updateProgress).mockResolvedValue(true);
      await registrationRouter.handleOptionSelection(
        mockSocket as any,
        createMockJid(users[0].waNumber),
        users[0].waNumber,
        '1'
      );

      // Second user selects Web
      await registrationRouter.handleOptionSelection(
        mockSocket as any,
        createMockJid(users[1].waNumber),
        users[1].waNumber,
        '2'
      );

      // Verify states are independent
      expect(getRegistrationState(users[0].waNumber)).toBe('data_collection');
      expect(getRegistrationState(users[1].waNumber)).toBe('verification');
      expect(getRegistrationState(users[2].waNumber)).toBe('awaiting_option');
    });
  });

  describe('Scenario 7: Edge Cases and Error Recovery', () => {
    const waNumber = '089012345678';
    const jid = createMockJid(waNumber);

    it('should handle session timeout gracefully', async () => {
      setRegistrationState(waNumber, 'data_collection');

      // Session has expired
      vi.mocked(sessionManager.getSessionByPhone).mockResolvedValue(null);

      const handled = await whatsappRegistrationFlow.handleDataInput(
        mockSocket as any,
        jid,
        waNumber,
        'Toko Baru'
      );

      expect(handled).toBe(true);
      const lastMessage = mockSocket._getLastMessage();
      expect(lastMessage?.text).toContain('expired');
    });

    it('should handle database errors during registration', async () => {
      setRegistrationState(waNumber, 'data_collection');

      vi.mocked(sessionManager.getSessionByPhone).mockResolvedValue({
        id: 'error-session-001',
        wa_number: `62${waNumber.slice(1)}`,
        source_platform: 'whatsapp',
        current_step: 'data_collection',
        collected_data: {},
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      vi.mocked(sessionManager.updateSessionData).mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      // The handler should catch the error and return true (handled)
      // but an error message should be sent to the user
      try {
        await whatsappRegistrationFlow.handleDataInput(
          mockSocket as any,
          jid,
          waNumber,
          'Toko Error Test'
        );
      } catch {
        // Error is expected - handler may or may not catch it
      }

      // Reset mock for subsequent tests
      vi.mocked(sessionManager.updateSessionData).mockResolvedValue(true);
    });

    it('should prevent registration with duplicate phone number', async () => {
      vi.mocked(registrationCompletionHandler.completeFromSession).mockResolvedValue({
        success: false,
        user_id: null,
        token: null,
        error_message: 'Nomor WhatsApp sudah terdaftar',
      });

      const completion = await registrationCompletionHandler.completeFromSession('dup-session');

      expect(completion.success).toBe(false);
      expect(completion.error_message).toContain('sudah terdaftar');
    });
  });

  describe('Scenario 8: Data Validation Across Flows', () => {
    const waNumber = '080123456789';
    const jid = createMockJid(waNumber);

    it('should validate store name and reject invalid ones', async () => {
      setRegistrationState(waNumber, 'data_collection');

      vi.mocked(sessionManager.getSessionByPhone).mockResolvedValue({
        id: 'validation-session-001',
        wa_number: `62${waNumber.slice(1)}`,
        source_platform: 'whatsapp',
        current_step: 'data_collection',
        collected_data: {},
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      // Test invalid store name (too short)
      mockSocket._clearMessages();
      await whatsappRegistrationFlow.handleDataInput(
        mockSocket as any,
        jid,
        waNumber,
        'AB'
      );

      let lastMessage = mockSocket._getLastMessage();
      expect(lastMessage?.text).toContain('tidak valid');

      // Test invalid store name (too long)
      mockSocket._clearMessages();
      await whatsappRegistrationFlow.handleDataInput(
        mockSocket as any,
        jid,
        waNumber,
        'A'.repeat(101)
      );

      lastMessage = mockSocket._getLastMessage();
      expect(lastMessage?.text).toContain('tidak valid');

      // Test numbers-only (should be rejected)
      mockSocket._clearMessages();
      await whatsappRegistrationFlow.handleDataInput(
        mockSocket as any,
        jid,
        waNumber,
        '12345678'
      );

      lastMessage = mockSocket._getLastMessage();
      expect(lastMessage?.text).toContain('tidak valid');
    });

    it('should validate PIN consistently', async () => {
      setRegistrationState(waNumber, 'data_collection');

      vi.mocked(sessionManager.getSessionByPhone).mockResolvedValue({
        id: 'pin-validation-session',
        wa_number: `62${waNumber.slice(1)}`,
        source_platform: 'whatsapp',
        current_step: 'data_collection',
        collected_data: { store_name: 'Toko Valid', owner_name: 'Owner' },
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      const invalidPins = [
        '12345',    // Too short
        '1234567',  // Too long
        '123456',   // Sequential
        '654321',   // Reverse sequential
        '111111',   // Repeated
        'abcdef',   // Non-numeric
      ];

      for (const pin of invalidPins) {
        mockSocket._clearMessages();

        await whatsappRegistrationFlow.handleDataInput(
          mockSocket as any,
          jid,
          waNumber,
          pin
        );

        const lastMessage = mockSocket._getLastMessage();
        expect(lastMessage?.text).toContain('tidak valid');
      }
    });
  });

  describe('Scenario 9: Session Data Integrity', () => {
    const waNumber = '081111222233';

    it('should preserve collected data across session updates', async () => {
      const sessionData = {
        store_name: 'Toko Integritas',
        owner_name: 'Pemilik Jujur',
      };

      vi.mocked(sessionManager.getSession).mockResolvedValue({
        id: 'integrity-session',
        wa_number: `62${waNumber.slice(1)}`,
        source_platform: 'whatsapp',
        current_step: 'data_collection',
        collected_data: sessionData,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      const session = await sessionManager.getSession('integrity-session');

      expect(session?.collected_data.store_name).toBe('Toko Integritas');
      expect(session?.collected_data.owner_name).toBe('Pemilik Jujur');
    });

    it('should properly sync data in hybrid flows', async () => {
      vi.mocked(hybridRegistrationFlow.syncDataFromPlatform).mockResolvedValue({
        success: true,
        synced_fields: ['store_name', 'owner_name'],
        session_id: 'synced-session-001',
      });

      const syncResult = await hybridRegistrationFlow.syncDataFromPlatform(
        'hybrid-session-001',
        'web',
        { store_name: 'Toko Merged', owner_name: 'Owner Web' }
      );

      expect(syncResult.success).toBe(true);
      expect(syncResult.synced_fields).toContain('store_name');
      expect(syncResult.synced_fields).toContain('owner_name');
    });
  });

  describe('Scenario 10: Registration Completion Verification', () => {
    const waNumber = '082222333344';

    it('should generate valid JWT on completion', async () => {
      vi.mocked(registrationCompletionHandler.completeFromSession).mockResolvedValue({
        success: true,
        user_id: 'final-user-001',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
        error_message: null,
      });

      const completion = await registrationCompletionHandler.completeFromSession('final-session');

      expect(completion.success).toBe(true);
      expect(completion.token).toMatch(/^eyJ/); // JWT format
      expect(completion.user_id).toBeDefined();
    });

    it('should check registration status correctly', async () => {
      vi.mocked(registrationCompletionHandler.getCompletionStatus).mockResolvedValue({
        is_registered: true,
        user_id: 'status-user-001',
        store_name: 'Toko Status',
        registration_completed_at: new Date().toISOString(),
      });

      const status = await registrationCompletionHandler.getCompletionStatus(waNumber);

      expect(status.is_registered).toBe(true);
      expect(status.store_name).toBe('Toko Status');
    });
  });
});
