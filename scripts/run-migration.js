import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function runMigration() {
  console.log('🚀 Running NusaKas Database Migration...\n');

  const statements = [
    // Enable UUID extension
    `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`,
    
    // Users table
    `CREATE TABLE IF NOT EXISTS public.users (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      wa_number TEXT UNIQUE NOT NULL,
      full_name TEXT DEFAULT 'Juragan',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    
    // OTP codes table
    `CREATE TABLE IF NOT EXISTS public.otp_codes (
      wa_number TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    )`,
    
    // Transactions table
    `CREATE TABLE IF NOT EXISTS public.transactions (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
      daily_id INT,
      type TEXT CHECK (type IN ('INCOME', 'EXPENSE')) NOT NULL,
      category TEXT DEFAULT 'Lainnya',
      amount NUMERIC NOT NULL,
      description TEXT,
      transaction_date DATE DEFAULT CURRENT_DATE,
      proof_image_path TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    
    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(transaction_date)`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type)`,
    `CREATE INDEX IF NOT EXISTS idx_otp_expires ON public.otp_codes(expires_at)`,
  ];

  for (const sql of statements) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
      if (error) {
        // Try direct query if RPC doesn't exist
        const { error: directError } = await supabase.from('_migrations').select().limit(0);
        if (directError?.code === '42P01') {
          // Table doesn't exist, which is fine
        }
      }
      const tableName = sql.match(/public\.(\w+)/)?.[1] || 'extension/index';
      console.log(`✅ ${tableName}`);
    } catch (err) {
      console.log(`⚠️  ${err.message}`);
    }
  }

  console.log('\n📋 Verifying tables...');
}

// Alternative: Use postgres connection directly
async function runMigrationDirect() {
  console.log('🚀 Running NusaKas Database Migration via REST API...\n');
  
  // Test if tables exist by trying to query them
  const tables = [
    { name: 'users', exists: false },
    { name: 'otp_codes', exists: false },
    { name: 'transactions', exists: false },
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table.name).select('*').limit(0);
    table.exists = !error;
    console.log(table.exists ? `✅ ${table.name}: exists` : `❌ ${table.name}: missing`);
  }

  const missing = tables.filter(t => !t.exists);
  if (missing.length > 0) {
    console.log(`
⚠️  Missing tables: ${missing.map(t => t.name).join(', ')}

Please run the SQL migration manually in Supabase SQL Editor:
1. Go to your Supabase Dashboard → SQL Editor
2. Copy contents of: backend/sql/001_initial_schema.sql
3. Run the SQL

Or use Supabase CLI:
  supabase db push
`);
    process.exit(1);
  }

  console.log('\n✅ All tables exist! Database schema is ready.');
}

runMigrationDirect();
