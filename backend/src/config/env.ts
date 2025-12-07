import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables from root .env file
config({ path: join(__dirname, '..', '..', '..', '.env') });

export const env = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',
  
  // Gemini AI
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'development_secret_change_in_production',
  JWT_EXPIRES_IN: '7d',
  
  // WhatsApp Bot
  WHATSAPP_BOT_NUMBER: process.env.WHATSAPP_BOT_NUMBER || '',
  
  // Frontend
  FRONTEND_URL: process.env.FRONTEND_URL || 'https://app.nusakas.id',
} as const;

// Validate required environment variables
export function validateEnv(): void {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'GEMINI_API_KEY'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
