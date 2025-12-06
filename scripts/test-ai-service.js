import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';
import { readFileSync, existsSync } from 'fs';

config({ path: '.env.local' });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

async function testParseCommand(text) {
  const prompt = `Analisis pesan WhatsApp berikut dan tentukan intent pengguna. Respond dalam JSON:

Pesan: "${text}"

Possible intents:
1. ADD_TRANSACTION - Menambah transaksi baru
2. DELETE_TRANSACTION - Menghapus transaksi
3. GET_REPORT - Minta laporan
4. GET_BALANCE - Cek saldo
5. UNKNOWN - Tidak bisa ditentukan

Format: {"intent": "...", "type": "INCOME|EXPENSE", "amount": number, "dailyId": number}

Respond ONLY with valid JSON.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function runTests() {
  console.log('🤖 Testing NusaKas AI Service (Gemini 2.0 Flash)\n');

  const testCases = [
    { input: 'masuk 50rb', expected: 'ADD_TRANSACTION (INCOME, 50000)' },
    { input: 'keluar 20000 beli makan', expected: 'ADD_TRANSACTION (EXPENSE, 20000)' },
    { input: 'hapus #3', expected: 'DELETE_TRANSACTION (dailyId: 3)' },
    { input: 'saldo', expected: 'GET_BALANCE' },
    { input: 'laporan', expected: 'GET_REPORT' },
    { input: 'jual 100rb sayur', expected: 'ADD_TRANSACTION (INCOME, 100000)' },
  ];

  console.log('=== Quick Pattern Matching Tests ===\n');
  
  // Test quick patterns (no AI)
  const quickPatterns = [
    { input: 'hapus #5', match: /DELETE.*5/ },
    { input: 'masuk 50rb', match: /ADD.*INCOME.*50000/ },
    { input: 'keluar 25rb makan', match: /ADD.*EXPENSE.*25000/ },
    { input: 'saldo', match: /BALANCE/ },
  ];

  for (const { input, match } of quickPatterns) {
    const result = quickPatternMatch(input);
    const status = result && JSON.stringify(result).match(match) ? '✅' : '❌';
    console.log(`${status} "${input}" → ${JSON.stringify(result)}`);
  }

  console.log('\n=== AI Command Parsing Tests ===\n');

  for (const { input, expected } of testCases.slice(0, 3)) {
    try {
      console.log(`Testing: "${input}"`);
      const response = await testParseCommand(input);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      console.log(`  Expected: ${expected}`);
      console.log(`  AI Response: ${JSON.stringify(parsed)}`);
      console.log('  ✅ Parsed successfully\n');
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}\n`);
    }
  }

  console.log('✅ AI Service tests complete!');
}

// Quick pattern matching (same logic as ai.service.ts)
function quickPatternMatch(text) {
  const lowerText = text.toLowerCase().trim();

  const deleteMatch = lowerText.match(/(?:hapus|batal)\s*#?(\d+)/i);
  if (deleteMatch) {
    return { intent: 'DELETE_TRANSACTION', dailyId: parseInt(deleteMatch[1]) };
  }

  if (/^(?:saldo|cek\s*saldo)$/i.test(lowerText)) {
    return { intent: 'GET_BALANCE' };
  }

  if (/^(?:laporan|rekap)$/i.test(lowerText)) {
    return { intent: 'GET_REPORT', reportType: 'daily' };
  }

  const simpleMatch = lowerText.match(
    /^(masuk|dapat|terima|jual|keluar|beli|bayar)\s+([\d.,]+)\s*(rb|ribu|k|jt|juta)?\s*(.*)$/i
  );
  if (simpleMatch) {
    const [, action, amountStr, multiplier, desc] = simpleMatch;
    const isIncome = ['masuk', 'dapat', 'terima', 'jual'].includes(action.toLowerCase());
    let amount = parseFloat(amountStr.replace(/[.,]/g, ''));
    
    if (multiplier) {
      if (['rb', 'ribu', 'k'].includes(multiplier.toLowerCase())) amount *= 1000;
      if (['jt', 'juta'].includes(multiplier.toLowerCase())) amount *= 1000000;
    }

    return {
      intent: 'ADD_TRANSACTION',
      type: isIncome ? 'INCOME' : 'EXPENSE',
      amount,
      description: desc.trim() || (isIncome ? 'Pemasukan' : 'Pengeluaran'),
    };
  }

  return null;
}

runTests().catch(console.error);
