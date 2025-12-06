import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as readline from 'readline';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const askQuestion = (query) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
};

async function checkTable() {
  // Try to get table info
  const { data, error } = await supabase.from('users').select('*').limit(1);
  console.log('Query result:', { data, error });
  
  const waNumber = await askQuestion('Enter WhatsApp number to test (e.g., 6281234567890): ');
  
  if (!waNumber) {
    console.log('No number provided, skipping insert test.');
    return;
  }

  // Try inserting a test user
  const { data: insertData, error: insertError } = await supabase
    .from('users')
    .insert({ wa_number: waNumber })
    .select()
    .single();
  
  console.log('Insert result:', { insertData, insertError });
  
  // Clean up test user if created
  if (insertData?.id) {
    await supabase.from('users').delete().eq('id', insertData.id);
    console.log('Test user cleaned up');
  }
}

checkTable();
