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
}

export type BotStyle = 'formal' | 'santai' | 'semi-formal';

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
