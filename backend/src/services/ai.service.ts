import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { env } from '../config/env.js';
import { settingsService } from './settings.service.js';

// Transaction extraction result from image analysis
export interface TransactionExtraction {
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  category: string;
  description: string;
  confidence: number;
}

// Command parsing result
export type CommandIntent = 
  | { intent: 'ADD_TRANSACTION'; data: TransactionExtraction }
  | { intent: 'ADD_MULTI_TRANSACTION'; data: TransactionExtraction[] }
  | { intent: 'DELETE_TRANSACTION'; dailyId: number }
  | { intent: 'EDIT_TRANSACTION'; dailyId: number; newAmount?: number; newDescription?: string }
  | { intent: 'GET_REPORT'; reportType: 'daily' | 'pdf' }
  | { intent: 'GET_BALANCE' }
  | { intent: 'VERIFY_OTP'; otpCode: string }
  | { intent: 'ONBOARDING_STYLE'; choice: number }
  | { intent: 'ONBOARDING_EMOJI'; choice: boolean }
  | { intent: 'SET_REMINDER_TIME'; time: string }
  | { intent: 'SET_OPERATIONAL_DAYS'; days: string[] }
  | { intent: 'UNKNOWN'; rawText: string };

// Rate limiting state
interface RateLimitState {
  requests: number;
  resetTime: number;
}

const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;

class AIService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private visionModel: GenerativeModel;
  private rateLimitState: RateLimitState = { requests: 0, resetTime: Date.now() };

  constructor() {
    this.genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    this.visionModel = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }

  private checkRateLimit(): void {
    const now = Date.now();
    if (now > this.rateLimitState.resetTime) {
      this.rateLimitState = { requests: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };
    }
    if (this.rateLimitState.requests >= MAX_REQUESTS_PER_WINDOW) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    this.rateLimitState.requests++;
  }

  /**
   * Analyze receipt/transaction image and extract transaction data
   */
  async analyzeImage(imageBuffer: Buffer, mimeType: string = 'image/jpeg'): Promise<TransactionExtraction> {
    this.checkRateLimit();

    const prompt = `Analisis gambar struk/nota/bukti transaksi ini dan ekstrak informasi berikut dalam format JSON:
{
  "type": "INCOME" atau "EXPENSE",
  "amount": angka nominal (tanpa Rp, titik, atau koma),
  "category": kategori transaksi (Makanan, Belanja, Transport, Gaji, Penjualan, Lainnya),
  "description": deskripsi singkat transaksi,
  "confidence": tingkat keyakinan 0-1
}

Panduan:
- Jika gambar adalah struk pembelian/pembayaran = EXPENSE
- Jika gambar adalah bukti transfer masuk/penjualan = INCOME
- Jika tidak jelas, gunakan EXPENSE sebagai default
- Jika tidak bisa membaca nominal, set amount = 0
- Pastikan amount adalah angka positif

Respond ONLY with valid JSON, no other text.`;

    try {
      const result = await this.visionModel.generateContent([
        prompt,
        {
          inlineData: {
            mimeType,
            data: imageBuffer.toString('base64'),
          },
        },
      ]);

      const response = await result.response;
      const text = response.text();
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as TransactionExtraction;
      
      // Validate and sanitize
      return {
        type: parsed.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
        amount: Math.abs(Number(parsed.amount)) || 0,
        category: parsed.category || 'Lainnya',
        description: String(parsed.description || '').slice(0, 200),
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
      };
    } catch (error) {
      console.error('Image analysis error:', error);
      // Return default extraction on error
      return {
        type: 'EXPENSE',
        amount: 0,
        category: 'Lainnya',
        description: 'Gagal membaca gambar',
        confidence: 0,
      };
    }
  }

  /**
   * Check if text likely contains multiple transactions
   */
  private looksLikeMultiTransaction(text: string): boolean {
    const lowerText = text.toLowerCase();
    // Keywords that suggest multiple transactions
    const multiKeywords = ['tapi', 'terus', 'lalu', 'kemudian', 'sama', 'dan juga', 'sekalian'];
    const hasMultiKeyword = multiKeywords.some(k => lowerText.includes(k));
    // Count transaction-like words
    const transactionWords = ['masuk', 'keluar', 'dapat', 'dapet', 'beli', 'bayar', 'jual', 'terima'];
    const transactionCount = transactionWords.filter(w => lowerText.includes(w)).length;
    return hasMultiKeyword && transactionCount >= 2;
  }

  /**
   * Parse text that may contain multiple transactions
   */
  async parseMultiTransaction(text: string): Promise<TransactionExtraction[]> {
    this.checkRateLimit();

    const prompt = `Analisis pesan WhatsApp berikut. Pesan ini MUNGKIN mengandung LEBIH DARI SATU transaksi.

Pesan: "${text}"

Ekstrak SEMUA transaksi dalam format JSON:
{
  "transactions": [
    {
      "type": "INCOME" atau "EXPENSE",
      "amount": angka (tanpa Rp/titik/koma),
      "category": "Gaji/Penjualan/Makanan/Rokok/Belanja/Transport/Lainnya",
      "description": "deskripsi singkat"
    }
  ]
}

Panduan:
- "dapet", "dapat", "terima", "masuk", "jual" = INCOME
- "beli", "bayar", "pake", "pakai", "keluar" = EXPENSE
- "rb"/"ribu" = x1000, "jt"/"juta" = x1000000
- Jika ada 2+ transaksi, masukkan semua ke array

Respond ONLY with valid JSON.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const responseText = response.text();

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const transactions = Array.isArray(parsed.transactions) ? parsed.transactions : [parsed];

      return transactions.map((t: Record<string, unknown>) => ({
        type: t.type === 'INCOME' ? 'INCOME' as const : 'EXPENSE' as const,
        amount: Math.abs(Number(t.amount)) || 0,
        category: String(t.category || 'Lainnya'),
        description: String(t.description || '').slice(0, 200),
        confidence: 0.85,
      }));
    } catch (error) {
      console.error('Multi-transaction parsing error:', error);
      return [];
    }
  }

  /**
   * Parse text command to detect user intent
   */
  async parseCommand(text: string): Promise<CommandIntent> {
    this.checkRateLimit();

    // Quick pattern matching for common commands (no AI needed)
    const quickMatch = this.quickPatternMatch(text);
    if (quickMatch) {
      return quickMatch;
    }

    // Check for multi-transaction pattern
    if (this.looksLikeMultiTransaction(text)) {
      const transactions = await this.parseMultiTransaction(text);
      if (transactions.length > 1) {
        return { intent: 'ADD_MULTI_TRANSACTION', data: transactions };
      }
      if (transactions.length === 1) {
        return { intent: 'ADD_TRANSACTION', data: transactions[0] };
      }
    }

    const prompt = `Analisis pesan WhatsApp berikut dan tentukan intent pengguna. Respond dalam JSON:

Pesan: "${text}"

Possible intents:
1. ADD_TRANSACTION - Menambah transaksi baru (contoh: "masuk 50rb", "keluar 20000 beli makan")
2. DELETE_TRANSACTION - Menghapus transaksi (contoh: "hapus #3", "batal yang #2")
3. EDIT_TRANSACTION - Mengubah transaksi (contoh: "edit #3 jadi 20rb")
4. GET_REPORT - Minta laporan (contoh: "laporan", "rekap", "download pdf")
5. GET_BALANCE - Cek saldo (contoh: "saldo", "cek saldo")
6. UNKNOWN - Tidak bisa ditentukan

Format response:
{
  "intent": "ADD_TRANSACTION|DELETE_TRANSACTION|EDIT_TRANSACTION|GET_REPORT|GET_BALANCE|UNKNOWN",
  "type": "INCOME|EXPENSE" (untuk ADD_TRANSACTION),
  "amount": number (untuk ADD/EDIT),
  "category": string (untuk ADD),
  "description": string (untuk ADD),
  "dailyId": number (untuk DELETE/EDIT, dari #N),
  "reportType": "daily|pdf" (untuk GET_REPORT)
}

Panduan:
- "masuk", "dapat", "terima", "jual" = INCOME
- "keluar", "beli", "bayar", "buat" = EXPENSE
- Angka dengan "rb" = ribu, "jt" = juta
- #N berarti daily_id = N

Respond ONLY with valid JSON.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const responseText = response.text();

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { intent: 'UNKNOWN', rawText: text };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return this.buildCommandIntent(parsed, text);
    } catch (error) {
      console.error('Command parsing error:', error);
      return { intent: 'UNKNOWN', rawText: text };
    }
  }

  /**
   * Quick pattern matching for common commands (avoids AI call)
   */
  private quickPatternMatch(text: string): CommandIntent | null {
    const lowerText = text.toLowerCase().trim();

    // VERIFY OTP: "VERIFY 1234", "verify 5678"
    const verifyMatch = text.match(/^verify\s+(\d{4,6})$/i);
    if (verifyMatch) {
      return { intent: 'VERIFY_OTP', otpCode: verifyMatch[1] };
    }

    // Onboarding style choice: "1", "2", "3" (single digit for style selection)
    if (/^[123]$/.test(lowerText)) {
      return { intent: 'ONBOARDING_STYLE', choice: parseInt(lowerText, 10) };
    }

    // Onboarding emoji choice: "ya", "tidak", "1", "2"
    if (/^(ya|yes|iya|mau|1)$/i.test(lowerText)) {
      return { intent: 'ONBOARDING_EMOJI', choice: true };
    }
    if (/^(tidak|no|gak|ga|nggak|2)$/i.test(lowerText)) {
      return { intent: 'ONBOARDING_EMOJI', choice: false };
    }

    // Delete command: "hapus #3", "batal #2"
    const deleteMatch = lowerText.match(/(?:hapus|batal|cancel|delete)\s*#?(\d+)/i);
    if (deleteMatch) {
      return { intent: 'DELETE_TRANSACTION', dailyId: parseInt(deleteMatch[1], 10) };
    }

    // Balance check
    if (/^(?:saldo|cek\s*saldo|balance)$/i.test(lowerText)) {
      return { intent: 'GET_BALANCE' };
    }

    // Report request
    if (/^(?:laporan|rekap|report|summary)$/i.test(lowerText)) {
      return { intent: 'GET_REPORT', reportType: 'daily' };
    }

    // PDF download
    if (/(?:download|unduh)\s*pdf/i.test(lowerText)) {
      return { intent: 'GET_REPORT', reportType: 'pdf' };
    }

    // SET_REMINDER_TIME: "set reminder jam 9 malam", "reminder 21:00", "ubah jam reminder 08.30"
    const reminderMatch = lowerText.match(/(?:set|ubah|ganti)?\s*(?:jam\s*)?reminder\s*(?:jam\s*)?(.+)/i) 
      || lowerText.match(/reminder\s*(?:jam\s*)?(.+)/i);
    if (reminderMatch) {
      const timeStr = reminderMatch[1].trim();
      const parsedTime = settingsService.parseTimeFromText(timeStr);
      if (parsedTime) {
        return { intent: 'SET_REMINDER_TIME', time: parsedTime };
      }
    }

    // Alternative time pattern: "jam reminder 21:00", "set jam 9 malam"
    const altTimeMatch = lowerText.match(/(?:set|ubah|ganti)\s*jam\s*(?:reminder\s*)?(.+)/i);
    if (altTimeMatch) {
      const timeStr = altTimeMatch[1].trim();
      const parsedTime = settingsService.parseTimeFromText(timeStr);
      if (parsedTime) {
        return { intent: 'SET_REMINDER_TIME', time: parsedTime };
      }
    }

    // SET_OPERATIONAL_DAYS: "buka senin sampai sabtu", "libur minggu", "hari operasional senin-jumat"
    const daysMatch = lowerText.match(/(?:toko(?:ku)?|usaha(?:ku)?|bisnis(?:ku)?)\s*(?:buka|operasional)\s*(?:hari\s*)?(.+)/i)
      || lowerText.match(/(?:hari\s*)?(?:operasional|kerja|buka)\s*(.+)/i)
      || lowerText.match(/(?:libur|tutup)\s*(?:hari\s*)?(.+)/i);
    if (daysMatch) {
      const daysStr = daysMatch[1].trim();
      const parsedDays = settingsService.parseDaysFromText(daysStr);
      if (parsedDays && parsedDays.length > 0) {
        return { intent: 'SET_OPERATIONAL_DAYS', days: parsedDays };
      }
    }

    // Simple income/expense pattern: "masuk 50rb", "keluar 20000"
    const simpleTransactionMatch = lowerText.match(
      /^(masuk|dapat|terima|jual|keluar|beli|bayar|buat)\s+([\d.,]+)\s*(rb|ribu|k|jt|juta)?\s*(.*)$/i
    );
    if (simpleTransactionMatch) {
      const [, action, amountStr, multiplier, desc] = simpleTransactionMatch;
      const isIncome = ['masuk', 'dapat', 'terima', 'jual'].includes(action.toLowerCase());
      let amount = parseFloat(amountStr.replace(/[.,]/g, ''));
      
      if (multiplier) {
        if (['rb', 'ribu', 'k'].includes(multiplier.toLowerCase())) amount *= 1000;
        if (['jt', 'juta'].includes(multiplier.toLowerCase())) amount *= 1000000;
      }

      return {
        intent: 'ADD_TRANSACTION',
        data: {
          type: isIncome ? 'INCOME' : 'EXPENSE',
          amount,
          category: 'Lainnya',
          description: desc.trim() || (isIncome ? 'Pemasukan' : 'Pengeluaran'),
          confidence: 0.9,
        },
      };
    }

    return null;
  }

  /**
   * Build CommandIntent from parsed AI response
   */
  private buildCommandIntent(parsed: Record<string, unknown>, rawText: string): CommandIntent {
    switch (parsed.intent) {
      case 'ADD_TRANSACTION':
        return {
          intent: 'ADD_TRANSACTION',
          data: {
            type: parsed.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
            amount: Math.abs(Number(parsed.amount)) || 0,
            category: String(parsed.category || 'Lainnya'),
            description: String(parsed.description || '').slice(0, 200),
            confidence: 0.8,
          },
        };
      
      case 'DELETE_TRANSACTION':
        return {
          intent: 'DELETE_TRANSACTION',
          dailyId: Number(parsed.dailyId) || 0,
        };
      
      case 'EDIT_TRANSACTION':
        return {
          intent: 'EDIT_TRANSACTION',
          dailyId: Number(parsed.dailyId) || 0,
          newAmount: parsed.amount ? Number(parsed.amount) : undefined,
          newDescription: parsed.description ? String(parsed.description) : undefined,
        };
      
      case 'GET_REPORT':
        return {
          intent: 'GET_REPORT',
          reportType: parsed.reportType === 'pdf' ? 'pdf' : 'daily',
        };
      
      case 'GET_BALANCE':
        return { intent: 'GET_BALANCE' };

      case 'SET_REMINDER_TIME':
        if (parsed.time && typeof parsed.time === 'string') {
          const parsedTime = settingsService.parseTimeFromText(parsed.time);
          if (parsedTime) {
            return { intent: 'SET_REMINDER_TIME', time: parsedTime };
          }
        }
        return { intent: 'UNKNOWN', rawText };

      case 'SET_OPERATIONAL_DAYS':
        if (parsed.days && typeof parsed.days === 'string') {
          const parsedDays = settingsService.parseDaysFromText(parsed.days);
          if (parsedDays && parsedDays.length > 0) {
            return { intent: 'SET_OPERATIONAL_DAYS', days: parsedDays };
          }
        }
        if (Array.isArray(parsed.days)) {
          return { intent: 'SET_OPERATIONAL_DAYS', days: parsed.days as string[] };
        }
        return { intent: 'UNKNOWN', rawText };
      
      default:
        return { intent: 'UNKNOWN', rawText };
    }
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): { remaining: number; resetIn: number } {
    const now = Date.now();
    if (now > this.rateLimitState.resetTime) {
      return { remaining: MAX_REQUESTS_PER_WINDOW, resetIn: 0 };
    }
    return {
      remaining: MAX_REQUESTS_PER_WINDOW - this.rateLimitState.requests,
      resetIn: Math.ceil((this.rateLimitState.resetTime - now) / 1000),
    };
  }
}

export const aiService = new AIService();
