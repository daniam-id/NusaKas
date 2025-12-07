import type { ValidationResult, RegistrationCollectedData } from '../types/index.js';

const INDONESIAN_PHONE_REGEX = /^(62|0)8[1-9][0-9]{7,10}$/;
const MIN_STORE_NAME_LENGTH = 3;
const MAX_STORE_NAME_LENGTH = 100;
const MIN_OWNER_NAME_LENGTH = 2;
const MAX_OWNER_NAME_LENGTH = 100;
const PIN_LENGTH = 6;

const BLOCKED_WORDS = [
  'admin', 'administrator', 'root', 'system', 'nusakas', 'test',
  'null', 'undefined', 'script', 'select', 'drop', 'insert',
];

const SEQUENTIAL_PINS = [
  '012345', '123456', '234567', '345678', '456789', '567890',
  '098765', '987654', '876543', '765432', '654321', '543210',
];

export function normalizePhoneNumber(waNumber: string): string {
  let normalized = waNumber.replace(/\D/g, '');
  
  if (normalized.startsWith('0')) {
    normalized = '62' + normalized.slice(1);
  }
  
  if (!normalized.startsWith('62')) {
    normalized = '62' + normalized;
  }
  
  return normalized;
}

export function validatePhoneNumber(waNumber: string): ValidationResult {
  const errors: string[] = [];
  
  if (!waNumber || waNumber.trim().length === 0) {
    errors.push('Nomor WhatsApp wajib diisi');
    return { valid: false, errors };
  }
  
  const cleaned = waNumber.replace(/[\s\-\(\)]/g, '');
  
  if (!INDONESIAN_PHONE_REGEX.test(cleaned)) {
    errors.push('Format nomor WhatsApp tidak valid. Gunakan format: 08xx atau 628xx');
  }
  
  const normalized = normalizePhoneNumber(cleaned);
  if (normalized.length < 10 || normalized.length > 15) {
    errors.push('Panjang nomor WhatsApp tidak valid (10-15 digit)');
  }
  
  return { valid: errors.length === 0, errors };
}

export function validateStoreName(storeName: string): ValidationResult {
  const errors: string[] = [];
  
  if (!storeName || storeName.trim().length === 0) {
    errors.push('Nama toko wajib diisi');
    return { valid: false, errors };
  }
  
  const trimmed = storeName.trim();
  
  if (trimmed.length < MIN_STORE_NAME_LENGTH) {
    errors.push(`Nama toko minimal ${MIN_STORE_NAME_LENGTH} karakter`);
  }
  
  if (trimmed.length > MAX_STORE_NAME_LENGTH) {
    errors.push(`Nama toko maksimal ${MAX_STORE_NAME_LENGTH} karakter`);
  }
  
  if (/^\d+$/.test(trimmed)) {
    errors.push('Nama toko tidak boleh hanya angka');
  }
  
  if (/^[\s\-_\.]+$/.test(trimmed)) {
    errors.push('Nama toko tidak boleh hanya karakter spesial');
  }
  
  const lowerName = trimmed.toLowerCase();
  for (const blocked of BLOCKED_WORDS) {
    if (lowerName === blocked || lowerName.includes(blocked)) {
      errors.push('Nama toko mengandung kata yang tidak diperbolehkan');
      break;
    }
  }
  
  if (/<[^>]*>|javascript:|on\w+=/i.test(trimmed)) {
    errors.push('Nama toko mengandung karakter yang tidak valid');
  }
  
  return { valid: errors.length === 0, errors };
}

export function validateOwnerName(ownerName: string): ValidationResult {
  const errors: string[] = [];
  
  if (!ownerName || ownerName.trim().length === 0) {
    errors.push('Nama pemilik wajib diisi');
    return { valid: false, errors };
  }
  
  const trimmed = ownerName.trim();
  
  if (trimmed.length < MIN_OWNER_NAME_LENGTH) {
    errors.push(`Nama pemilik minimal ${MIN_OWNER_NAME_LENGTH} karakter`);
  }
  
  if (trimmed.length > MAX_OWNER_NAME_LENGTH) {
    errors.push(`Nama pemilik maksimal ${MAX_OWNER_NAME_LENGTH} karakter`);
  }
  
  if (/^\d+$/.test(trimmed)) {
    errors.push('Nama pemilik tidak boleh hanya angka');
  }
  
  if (!/^[\p{L}\s\.\-']+$/u.test(trimmed)) {
    errors.push('Nama pemilik hanya boleh mengandung huruf, spasi, titik, strip, dan apostrof');
  }
  
  if (/<[^>]*>|javascript:|on\w+=/i.test(trimmed)) {
    errors.push('Nama pemilik mengandung karakter yang tidak valid');
  }
  
  return { valid: errors.length === 0, errors };
}

export function validatePIN(pin: string): ValidationResult {
  const errors: string[] = [];
  
  if (!pin || pin.trim().length === 0) {
    errors.push('PIN wajib diisi');
    return { valid: false, errors };
  }
  
  const trimmed = pin.trim();
  
  if (!/^\d+$/.test(trimmed)) {
    errors.push('PIN harus berupa angka');
    return { valid: false, errors };
  }
  
  if (trimmed.length !== PIN_LENGTH) {
    errors.push(`PIN harus ${PIN_LENGTH} digit`);
  }
  
  if (/^(\d)\1{5}$/.test(trimmed)) {
    errors.push('PIN tidak boleh angka berulang (contoh: 111111)');
  }
  
  if (SEQUENTIAL_PINS.includes(trimmed)) {
    errors.push('PIN tidak boleh angka berurutan (contoh: 123456)');
  }
  
  const digits = trimmed.split('');
  const uniqueDigits = new Set(digits);
  if (uniqueDigits.size < 3) {
    errors.push('PIN harus mengandung minimal 3 angka berbeda');
  }
  
  return { valid: errors.length === 0, errors };
}

export function validateRegistrationData(data: Partial<RegistrationCollectedData>): ValidationResult {
  const allErrors: string[] = [];
  
  if (data.store_name !== undefined) {
    const storeResult = validateStoreName(data.store_name);
    allErrors.push(...storeResult.errors);
  }
  
  if (data.owner_name !== undefined) {
    const ownerResult = validateOwnerName(data.owner_name);
    allErrors.push(...ownerResult.errors);
  }
  
  return { valid: allErrors.length === 0, errors: allErrors };
}

export function validateCompleteRegistration(data: RegistrationCollectedData): ValidationResult {
  const allErrors: string[] = [];
  
  if (!data.store_name) {
    allErrors.push('Nama toko wajib diisi');
  } else {
    const storeResult = validateStoreName(data.store_name);
    allErrors.push(...storeResult.errors);
  }
  
  if (!data.owner_name) {
    allErrors.push('Nama pemilik wajib diisi');
  } else {
    const ownerResult = validateOwnerName(data.owner_name);
    allErrors.push(...ownerResult.errors);
  }
  
  if (!data.pin_hash) {
    allErrors.push('PIN wajib diset');
  }
  
  return { valid: allErrors.length === 0, errors: allErrors };
}

export function sanitizeStoreName(storeName: string): string {
  return storeName
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>'"`;]/g, '')
    .slice(0, MAX_STORE_NAME_LENGTH);
}

export function sanitizeOwnerName(ownerName: string): string {
  return ownerName
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>'"`;]/g, '')
    .slice(0, MAX_OWNER_NAME_LENGTH);
}

export function sanitizePhoneNumber(waNumber: string): string {
  return waNumber.replace(/[^\d+]/g, '');
}

export function formatPhoneForDisplay(waNumber: string): string {
  const normalized = normalizePhoneNumber(waNumber);
  
  if (normalized.length === 12) {
    return `+${normalized.slice(0, 2)} ${normalized.slice(2, 5)}-${normalized.slice(5, 9)}-${normalized.slice(9)}`;
  }
  
  if (normalized.length === 13) {
    return `+${normalized.slice(0, 2)} ${normalized.slice(2, 5)}-${normalized.slice(5, 9)}-${normalized.slice(9)}`;
  }
  
  return `+${normalized}`;
}

export function maskPhoneNumber(waNumber: string): string {
  const normalized = normalizePhoneNumber(waNumber);
  
  if (normalized.length < 8) {
    return normalized;
  }
  
  const prefix = normalized.slice(0, 4);
  const suffix = normalized.slice(-4);
  const masked = '*'.repeat(normalized.length - 8);
  
  return `${prefix}${masked}${suffix}`;
}

export function isValidOTPFormat(otp: string): boolean {
  return /^\d{6}$/.test(otp.trim());
}

export function generateValidationSummary(result: ValidationResult): string {
  if (result.valid) {
    return 'Validasi berhasil';
  }
  
  return `Validasi gagal:\n${result.errors.map(e => `• ${e}`).join('\n')}`;
}

export const validationRules = {
  phone: {
    minLength: 10,
    maxLength: 15,
    pattern: INDONESIAN_PHONE_REGEX,
  },
  storeName: {
    minLength: MIN_STORE_NAME_LENGTH,
    maxLength: MAX_STORE_NAME_LENGTH,
  },
  ownerName: {
    minLength: MIN_OWNER_NAME_LENGTH,
    maxLength: MAX_OWNER_NAME_LENGTH,
  },
  pin: {
    length: PIN_LENGTH,
    minUniqueDigits: 3,
  },
} as const;
