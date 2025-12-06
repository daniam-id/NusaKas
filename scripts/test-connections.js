/**
 * NusaKas Connection Test Script
 * Tests Supabase and Gemini API connections
 * Run: node scripts/test-connections.js
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
config({ path: join(__dirname, '..', '.env.local') });

async function testSupabase() {
  console.log('\n🔄 Testing Supabase connection...');
  
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log('❌ Supabase: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    return false;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Test by listing schemas - always works if connected
    const { data, error } = await supabase.rpc('version');
    
    // If we get any response (even error about function not existing), connection works
    if (error && error.message.includes('Could not find')) {
      // Connection works, just no custom function - that's fine
      console.log('✅ Supabase: Connected successfully');
      return true;
    }
    
    if (error) {
      console.log('❌ Supabase:', error.message);
      return false;
    }
    
    console.log('✅ Supabase: Connected successfully');
    return true;
  } catch (err) {
    console.log('❌ Supabase:', err.message);
    return false;
  }
}

async function testGemini() {
  console.log('\n🔄 Testing Gemini API connection...');
  
  const { GEMINI_API_KEY } = process.env;
  
  if (!GEMINI_API_KEY) {
    console.log('❌ Gemini: Missing GEMINI_API_KEY');
    return false;
  }

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    // Simple test prompt
    const result = await model.generateContent('Say "OK" if you can read this.');
    const response = await result.response;
    const text = response.text();
    
    if (text) {
      console.log('✅ Gemini: Connected successfully');
      return true;
    }
    
    console.log('❌ Gemini: No response received');
    return false;
  } catch (err) {
    console.log('❌ Gemini:', err.message);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('   NusaKas Connection Test');
  console.log('═══════════════════════════════════════');
  
  const results = {
    supabase: await testSupabase(),
    gemini: await testGemini()
  };
  
  console.log('\n═══════════════════════════════════════');
  console.log('   Summary');
  console.log('═══════════════════════════════════════');
  console.log(`Supabase: ${results.supabase ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Gemini:   ${results.gemini ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = Object.values(results).every(r => r);
  console.log(`\n${allPassed ? '🎉 All connections successful!' : '⚠️  Some connections failed. Check your .env.local'}`);
  
  process.exit(allPassed ? 0 : 1);
}

main();
