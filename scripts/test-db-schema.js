import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testSchema() {
  console.log('🔍 Testing NusaKas Database Schema...\n');

  const tables = ['users', 'otp_codes', 'transactions'];
  let allPassed = true;

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(`❌ Table '${table}': ${error.message}`);
        allPassed = false;
      } else {
        console.log(`✅ Table '${table}': OK`);
      }
    } catch (err) {
      console.log(`❌ Table '${table}': ${err.message}`);
      allPassed = false;
    }
  }

  console.log('\n' + (allPassed 
    ? '✅ All tables exist! Database schema is ready.' 
    : '⚠️  Some tables missing. Run SQL migration in Supabase SQL Editor:\n   → backend/sql/001_initial_schema.sql'));
  
  process.exit(allPassed ? 0 : 1);
}

testSchema();
