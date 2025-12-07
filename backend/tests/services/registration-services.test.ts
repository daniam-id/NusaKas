import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/config/supabase.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../src/config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-secret-key-for-testing',
    FRONTEND_URL: 'https://test.nusakas.id',
    WHATSAPP_BOT_NUMBER: '6281234567890',
  },
}));

import {
  validatePhoneNumber,
  validateStoreName,
  validateOwnerName,
  validatePIN,
  validateRegistrationData,
  validateCompleteRegistration,
  normalizePhoneNumber,
  sanitizeStoreName,
  sanitizeOwnerName,
  maskPhoneNumber,
  isValidOTPFormat,
} from '../../src/utils/registration-validation.js';

describe('Registration Validation Utilities', () => {
  describe('validatePhoneNumber', () => {
    it('should validate correct Indonesian phone numbers', () => {
      expect(validatePhoneNumber('081234567890').valid).toBe(true);
      expect(validatePhoneNumber('6281234567890').valid).toBe(true);
      expect(validatePhoneNumber('08123456789').valid).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(validatePhoneNumber('').valid).toBe(false);
      expect(validatePhoneNumber('12345').valid).toBe(false);
      expect(validatePhoneNumber('01234567890').valid).toBe(false);
    });

    it('should handle phone numbers with formatting', () => {
      const result = validatePhoneNumber('0812-3456-7890');
      expect(result.valid).toBe(true);
    });

    it('should return specific error messages', () => {
      const result = validatePhoneNumber('');
      expect(result.errors).toContain('Nomor WhatsApp wajib diisi');
    });
  });

  describe('validateStoreName', () => {
    it('should validate correct store names', () => {
      expect(validateStoreName('Toko Sembako Makmur').valid).toBe(true);
      expect(validateStoreName('Warung Bu Ani').valid).toBe(true);
      expect(validateStoreName('ABC').valid).toBe(true);
    });

    it('should reject store names that are too short', () => {
      const result = validateStoreName('AB');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('minimal'))).toBe(true);
    });

    it('should reject store names that are only numbers', () => {
      const result = validateStoreName('12345');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('hanya angka'))).toBe(true);
    });

    it('should reject store names with blocked words', () => {
      const result = validateStoreName('admin');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('tidak diperbolehkan'))).toBe(true);
    });

    it('should reject store names with XSS attempts', () => {
      const result = validateStoreName('<script>alert(1)</script>');
      expect(result.valid).toBe(false);
    });

    it('should reject empty store names', () => {
      const result = validateStoreName('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Nama toko wajib diisi');
    });
  });

  describe('validateOwnerName', () => {
    it('should validate correct owner names', () => {
      expect(validateOwnerName('Budi Santoso').valid).toBe(true);
      expect(validateOwnerName('Sri Mulyani').valid).toBe(true);
      expect(validateOwnerName("O'Connor").valid).toBe(true);
    });

    it('should reject owner names that are too short', () => {
      const result = validateOwnerName('A');
      expect(result.valid).toBe(false);
    });

    it('should reject owner names with numbers', () => {
      const result = validateOwnerName('Budi123');
      expect(result.valid).toBe(false);
    });

    it('should reject owner names that are only numbers', () => {
      const result = validateOwnerName('12345');
      expect(result.valid).toBe(false);
    });

    it('should allow Indonesian names with special characters', () => {
      expect(validateOwnerName('Siti Nurhaliza').valid).toBe(true);
      expect(validateOwnerName('M. Rizky').valid).toBe(true);
    });
  });

  describe('validatePIN', () => {
    it('should validate correct PINs', () => {
      expect(validatePIN('123789').valid).toBe(true);
      expect(validatePIN('945621').valid).toBe(true);
    });

    it('should reject PINs with wrong length', () => {
      expect(validatePIN('12345').valid).toBe(false);
      expect(validatePIN('1234567').valid).toBe(false);
    });

    it('should reject repeated digit PINs', () => {
      const result = validatePIN('111111');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('berulang'))).toBe(true);
    });

    it('should reject sequential PINs', () => {
      expect(validatePIN('123456').valid).toBe(false);
      expect(validatePIN('654321').valid).toBe(false);
    });

    it('should reject PINs with less than 3 unique digits', () => {
      const result = validatePIN('112211');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('3 angka berbeda'))).toBe(true);
    });

    it('should reject non-numeric PINs', () => {
      const result = validatePIN('12345a');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('PIN harus berupa angka');
    });
  });

  describe('validateRegistrationData', () => {
    it('should validate partial data with valid store name', () => {
      const result = validateRegistrationData({
        store_name: 'Toko Makmur Jaya',
      });
      expect(result.valid).toBe(true);
    });

    it('should collect all errors from invalid partial data', () => {
      const result = validateRegistrationData({
        store_name: 'AB',
        owner_name: 'X',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('validateCompleteRegistration', () => {
    it('should pass with all valid data', () => {
      const result = validateCompleteRegistration({
        store_name: 'Toko Makmur Jaya',
        owner_name: 'Budi Santoso',
        pin_hash: 'hashed_pin',
      });
      expect(result.valid).toBe(true);
    });

    it('should fail when store_name is missing', () => {
      const result = validateCompleteRegistration({
        owner_name: 'Budi Santoso',
        pin_hash: 'hashed_pin',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('toko'))).toBe(true);
    });

    it('should fail when owner_name is missing', () => {
      const result = validateCompleteRegistration({
        store_name: 'Toko Makmur Jaya',
        pin_hash: 'hashed_pin',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('pemilik'))).toBe(true);
    });

    it('should fail when pin_hash is missing', () => {
      const result = validateCompleteRegistration({
        store_name: 'Toko Makmur Jaya',
        owner_name: 'Budi Santoso',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('PIN'))).toBe(true);
    });
  });

  describe('normalizePhoneNumber', () => {
    it('should convert 0 prefix to 62', () => {
      expect(normalizePhoneNumber('081234567890')).toBe('6281234567890');
    });

    it('should keep 62 prefix', () => {
      expect(normalizePhoneNumber('6281234567890')).toBe('6281234567890');
    });

    it('should add 62 prefix if missing', () => {
      expect(normalizePhoneNumber('81234567890')).toBe('6281234567890');
    });

    it('should remove non-digit characters', () => {
      expect(normalizePhoneNumber('0812-3456-7890')).toBe('6281234567890');
      expect(normalizePhoneNumber('+62 812 345 6789')).toBe('628123456789');
    });
  });

  describe('sanitizeStoreName', () => {
    it('should trim whitespace', () => {
      expect(sanitizeStoreName('  Toko Test  ')).toBe('Toko Test');
    });

    it('should remove HTML tags', () => {
      expect(sanitizeStoreName('Toko <b>Test</b>')).toBe('Toko Test');
    });

    it('should remove dangerous characters', () => {
      expect(sanitizeStoreName("Toko's \"Test\"")).toBe('Tokos Test');
    });

    it('should collapse multiple spaces', () => {
      expect(sanitizeStoreName('Toko    Test')).toBe('Toko Test');
    });
  });

  describe('sanitizeOwnerName', () => {
    it('should trim whitespace', () => {
      expect(sanitizeOwnerName('  Budi  ')).toBe('Budi');
    });

    it('should remove HTML tags', () => {
      expect(sanitizeOwnerName('Budi <script>alert(1)</script>')).toBe('Budi alert(1)');
    });
  });

  describe('maskPhoneNumber', () => {
    it('should mask middle digits', () => {
      const masked = maskPhoneNumber('6281234567890');
      expect(masked.startsWith('6281')).toBe(true);
      expect(masked.endsWith('7890')).toBe(true);
      expect(masked.includes('*')).toBe(true);
    });

    it('should handle short numbers without masking', () => {
      const masked = maskPhoneNumber('6212345');
      expect(masked).toBe('6212345');
    });
  });

  describe('isValidOTPFormat', () => {
    it('should validate 6-digit OTPs', () => {
      expect(isValidOTPFormat('123456')).toBe(true);
      expect(isValidOTPFormat('000000')).toBe(true);
    });

    it('should reject invalid OTPs', () => {
      expect(isValidOTPFormat('12345')).toBe(false);
      expect(isValidOTPFormat('1234567')).toBe(false);
      expect(isValidOTPFormat('12345a')).toBe(false);
      expect(isValidOTPFormat('')).toBe(false);
    });

    it('should handle whitespace', () => {
      expect(isValidOTPFormat(' 123456 ')).toBe(true);
    });
  });
});

describe('Registration Types', () => {
  it('should have correct type exports', async () => {
    const types = await import('../../src/types/index.js');
    
    expect(types.REGISTRATION_OPTIONS).toBeDefined();
    expect(types.REGISTRATION_OPTIONS.length).toBe(2);
    expect(types.REGISTRATION_FIELDS).toBeDefined();
    expect(types.REGISTRATION_PROMPTS).toBeDefined();
  });

  it('should have correct registration options', async () => {
    const { REGISTRATION_OPTIONS } = await import('../../src/types/index.js');
    
    const keys = REGISTRATION_OPTIONS.map(o => o.key);
    expect(keys).toContain('1');
    expect(keys).toContain('2');
  });

  it('should have correct registration fields', async () => {
    const { REGISTRATION_FIELDS } = await import('../../src/types/index.js');
    
    expect(REGISTRATION_FIELDS).toContain('store_name');
    expect(REGISTRATION_FIELDS).toContain('owner_name');
    expect(REGISTRATION_FIELDS).toContain('pin_hash');
  });
});

describe('Edge Cases', () => {
  describe('Unicode handling', () => {
    it('should handle Indonesian names with diacritics', () => {
      expect(validateOwnerName('Résumé').valid).toBe(true);
    });

    it('should handle Chinese characters in store names', () => {
      const result = validateStoreName('东方商店');
      expect(result.valid).toBe(true);
    });
  });

  describe('Boundary conditions', () => {
    it('should handle exactly minimum length store name', () => {
      expect(validateStoreName('ABC').valid).toBe(true);
    });

    it('should handle exactly minimum length owner name', () => {
      expect(validateOwnerName('AB').valid).toBe(true);
    });

    it('should reject store name at max length + 1', () => {
      const longName = 'A'.repeat(101);
      expect(validateStoreName(longName).valid).toBe(false);
    });
  });

  describe('Special inputs', () => {
    it('should handle null-like strings', () => {
      expect(validateStoreName('null').valid).toBe(false);
      expect(validateStoreName('undefined').valid).toBe(false);
    });

    it('should handle whitespace-only inputs', () => {
      expect(validateStoreName('   ').valid).toBe(false);
      expect(validateOwnerName('   ').valid).toBe(false);
      expect(validatePIN('   ').valid).toBe(false);
    });
  });
});
