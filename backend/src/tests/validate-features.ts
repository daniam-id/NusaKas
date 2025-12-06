/**
 * NusaKas Feature Validation Script
 * Tests the new reminder, verification, and style customization features
 * Run with: npx tsx src/tests/validate-features.ts
 */

import { settingsService } from '../services/settings.service.js';
import { formatReplyService } from '../services/format-reply.service.js';
import type { User, BotStyle } from '../types/index.js';

console.log('=== NusaKas Feature Validation ===\n');

let passed = 0;
let failed = 0;

function test(name: string, condition: boolean, details?: string): void {
  if (condition) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.log(`❌ ${name}${details ? ` - ${details}` : ''}`);
    failed++;
  }
}

// ========== Test 1: Time Parsing ==========
console.log('\n--- Time Parsing Tests ---');

test('Parse "21:00"', settingsService.parseTimeFromText('21:00') === '21:00');
test('Parse "21.00"', settingsService.parseTimeFromText('21.00') === '21:00');
test('Parse "9 malam"', settingsService.parseTimeFromText('9 malam') === '21:00');
test('Parse "8 pagi"', settingsService.parseTimeFromText('8 pagi') === '08:00');
test('Parse "9"', settingsService.parseTimeFromText('9') === '09:00');
test('Parse "21"', settingsService.parseTimeFromText('21') === '21:00');
test('Parse invalid returns null', settingsService.parseTimeFromText('invalid') === null);

// ========== Test 2: Day Parsing ==========
console.log('\n--- Day Parsing Tests ---');

const seninsabtu = settingsService.parseDaysFromText('senin sampai sabtu');
test('Parse "senin sampai sabtu"', 
  seninsabtu !== null && seninsabtu.length === 6 && seninsabtu[0] === 'monday',
  `Got: ${JSON.stringify(seninsabtu)}`);

const seninJumat = settingsService.parseDaysFromText('senin-jumat');
test('Parse "senin-jumat"', 
  seninJumat !== null && seninJumat.length === 5,
  `Got: ${JSON.stringify(seninJumat)}`);

const liburMinggu = settingsService.parseDaysFromText('libur minggu');
test('Parse "libur minggu" (exclude sunday)', 
  liburMinggu !== null && !liburMinggu.includes('sunday'),
  `Got: ${JSON.stringify(liburMinggu)}`);

const singleDay = settingsService.parseDaysFromText('senin');
test('Parse "senin" single day', 
  singleDay !== null && singleDay.length === 1 && singleDay[0] === 'monday',
  `Got: ${JSON.stringify(singleDay)}`);

// ========== Test 3: Settings Validation ==========
console.log('\n--- Settings Validation Tests ---');

const validSettings = settingsService.validateSettings({
  reminder_time: '21:00',
  bot_style: 'santai',
  use_emoji: true,
  operational_days: ['monday', 'tuesday'],
});
test('Valid settings pass validation', validSettings.valid);

const invalidTime = settingsService.validateSettings({ reminder_time: '25:00' });
test('Invalid time fails validation', !invalidTime.valid);

const invalidStyle = settingsService.validateSettings({ bot_style: 'invalid' as BotStyle });
test('Invalid style fails validation', !invalidStyle.valid);

const emptyDays = settingsService.validateSettings({ operational_days: [] });
test('Empty days fails validation', !emptyDays.valid);

// ========== Test 4: Format Reply Service ==========
console.log('\n--- Format Reply Tests ---');

const testUser: User = {
  id: 'test-id',
  wa_number: '628123456789',
  full_name: 'Test User',
  created_at: new Date().toISOString(),
  bot_style: 'santai',
  use_emoji: true,
};

const welcomeSantai = formatReplyService.formatWelcome(testUser);
test('Welcome message (santai + emoji)', 
  welcomeSantai.includes('👋') && welcomeSantai.includes('Test User'));

const formalUser: User = { ...testUser, bot_style: 'formal', use_emoji: false };
const welcomeFormal = formatReplyService.formatWelcome(formalUser);
test('Welcome message (formal, no emoji)', 
  !welcomeFormal.includes('👋') && welcomeFormal.includes('Test User'));

const reminderMsg = formatReplyService.formatReminderMessage(testUser);
test('Reminder message generated', reminderMsg.length > 0);

const settingsMsg = formatReplyService.formatSettingsUpdated(testUser, 'waktu reminder', '21:00');
test('Settings updated message', settingsMsg.includes('21:00'));

// ========== Summary ==========
console.log('\n=== Validation Summary ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

if (failed > 0) {
  process.exit(1);
}

console.log('\n✅ All feature validations passed!');
