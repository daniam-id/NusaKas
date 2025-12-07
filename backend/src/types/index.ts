export interface User {
  id: string;
  wa_number: string;
  full_name: string;
  created_at: string;
  reminder_time?: string;
  operational_days?: string[];
  bot_style?: BotStyle;
  use_emoji?: boolean;
  onboarding_complete?: boolean;
  pin_hash?: string | null;
  store_name?: string | null;
  owner_name?: string | null;
  registration_method?: RegistrationMethod | null;
  registration_completed_at?: string | null;
}

export type BotStyle = 'formal' | 'santai' | 'semi-formal';

export type RegistrationMethod = 'whatsapp' | 'web' | 'hybrid';
export type RegistrationStep = 'options' | 'data_collection' | 'verification' | 'completed';
export type RegistrationStatus = 'pending' | 'active' | 'completed' | 'expired';
export type OTPPurpose = 'web_verification' | 'whatsapp_verification' | 'hybrid_link';
export type OTPStatus = 'pending' | 'used' | 'expired';

export interface UserSettings {
  reminder_time: string;
  operational_days: string[];
  bot_style: BotStyle;
  use_emoji: boolean;
}

export interface PendingRegistration {
  wa_number: string;
  otp_code: string;
  created_at: string;
  expires_at: string;
}

export interface VerificationResult {
  success: boolean;
  message: string;
  wa_link?: string;
  wa_number?: string;
  otp_code?: string;
  expires_at?: string;
  user?: User;
  token?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface Transaction {
  id: string;
  user_id: string;
  daily_id: number;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  description: string | null;
  transaction_date: string;
  proof_image_path: string | null;
  created_at: string;
}

export interface OtpCode {
  wa_number: string;
  code: string;
  expires_at: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface StatsResponse {
  income: number;
  expense: number;
  balance: number;
}

export interface JwtPayload {
  userId: string;
  waNumber: string;
  iat?: number;
  exp?: number;
}

export interface RegistrationCollectedData {
  store_name?: string;
  owner_name?: string;
  pin_hash?: string;
  contact_info?: {
    email?: string;
    address?: string;
  };
}

export interface RegistrationSession {
  id: string;
  wa_number: string;
  source_platform: RegistrationMethod;
  current_step: RegistrationStep;
  collected_data: RegistrationCollectedData;
  status: RegistrationStatus;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export interface OTPVerification {
  id: string;
  wa_number: string;
  otp_code: string;
  purpose: OTPPurpose;
  source_session: string | null;
  status: OTPStatus;
  attempts: number;
  max_attempts: number;
  created_at: string;
  expires_at: string;
  used_at: string | null;
}

export interface CreateSessionRequest {
  wa_number: string;
  source_platform?: RegistrationMethod;
}

export interface CreateSessionResponse {
  session_id: string;
  is_new: boolean;
  current_step: RegistrationStep;
  collected_data: RegistrationCollectedData;
}

export interface UpdateSessionRequest {
  session_id: string;
  step?: RegistrationStep;
  data?: Partial<RegistrationCollectedData>;
}

export interface GenerateOTPRequest {
  wa_number: string;
  purpose: OTPPurpose;
  session_id?: string;
}

export interface GenerateOTPResponse {
  otp_id: string;
  otp_code: string;
  expires_at: string;
  verification_link?: string;
}

export interface ValidateOTPRequest {
  wa_number: string;
  otp_code: string;
}

export interface ValidateOTPResponse {
  is_valid: boolean;
  otp_id: string | null;
  session_id: string | null;
  error_message: string | null;
}

export interface CompleteRegistrationRequest {
  session_id: string;
}

export interface CompleteRegistrationResponse {
  success: boolean;
  user_id: string | null;
  error_message: string | null;
}

export interface RegistrationFlowState {
  session: RegistrationSession | null;
  currentField: keyof RegistrationCollectedData | null;
  validationErrors: string[];
}

export interface RegistrationOption {
  key: string;
  label: string;
  description: string;
}

export const REGISTRATION_OPTIONS: RegistrationOption[] = [
  { key: '1', label: 'Lanjutkan di WhatsApp', description: 'Daftar langsung di chat ini' },
  { key: '2', label: 'Daftar di Website', description: 'Buka link untuk daftar di browser' },
];

export const REGISTRATION_FIELDS: (keyof RegistrationCollectedData)[] = [
  'store_name',
  'owner_name',
  'pin_hash',
];

export interface RegistrationFieldPrompt {
  field: keyof RegistrationCollectedData;
  prompt: string;
  validation?: (value: string) => ValidationResult;
}

export const REGISTRATION_PROMPTS: RegistrationFieldPrompt[] = [
  { field: 'store_name', prompt: 'Silakan masukkan nama toko/usaha Anda:' },
  { field: 'owner_name', prompt: 'Siapa nama pemilik toko?' },
  { field: 'pin_hash', prompt: 'Buat PIN 6 digit untuk keamanan akun:' },
];
