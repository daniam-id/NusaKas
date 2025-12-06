import { WASocket, proto, downloadMediaMessage } from '@whiskeysockets/baileys';
import { transactionService } from '../../services/transaction.service.js';
import { aiService, TransactionExtraction } from '../../services/ai.service.js';
import { getSupabase } from '../../config/supabase.js';

interface UserRecord {
  id: string;
  wa_number: string;
}

class TransactionHandler {
  async handleAdd(
    sock: WASocket,
    jid: string,
    user: UserRecord,
    data: TransactionExtraction
  ): Promise<void> {
    try {
      const transaction = await transactionService.create({
        userId: user.id,
        type: data.type,
        amount: data.amount,
        category: data.category,
        description: data.description,
      });

      const emoji = data.type === 'INCOME' ? '💰' : '💸';
      const typeText = data.type === 'INCOME' ? 'Masuk' : 'Keluar';

      await sock.sendMessage(jid, {
        text: `${emoji} *${typeText} Bos!* (#${transaction.daily_id})

💵 ${this.formatCurrency(data.amount)}
📁 ${data.category}
📝 ${data.description || '-'}

Ketik "hapus #${transaction.daily_id}" untuk membatalkan.`,
      });
    } catch (error) {
      console.error('[WA] Add transaction error:', error);
      await sock.sendMessage(jid, {
        text: '❌ Gagal mencatat transaksi. Silakan coba lagi.',
      });
    }
  }

  async handleMultiAdd(
    sock: WASocket,
    jid: string,
    user: UserRecord,
    dataList: TransactionExtraction[]
  ): Promise<void> {
    try {
      const transactions = await transactionService.createMultiple(
        dataList.map(data => ({
          userId: user.id,
          type: data.type,
          amount: data.amount,
          category: data.category,
          description: data.description,
        }))
      );

      let message = `✅ *${transactions.length} Transaksi Dicatat!*\n\n`;

      for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i];
        const data = dataList[i];
        const emoji = tx.type === 'INCOME' ? '💰' : '💸';
        message += `${emoji} #${tx.daily_id} - ${this.formatCurrency(data.amount)} (${data.category})\n`;
      }

      message += `\nKetik "hapus #N" untuk membatalkan.`;

      await sock.sendMessage(jid, { text: message });
    } catch (error) {
      console.error('[WA] Multi-add transaction error:', error);
      await sock.sendMessage(jid, {
        text: '❌ Gagal mencatat transaksi. Silakan coba lagi.',
      });
    }
  }

  async handleImage(
    sock: WASocket,
    message: proto.IWebMessageInfo,
    user: UserRecord,
    caption?: string
  ): Promise<void> {
    const jid = message.key.remoteJid!;

    try {
      await sock.sendMessage(jid, { text: '🔍 Menganalisis gambar...' });

      // Download image
      const buffer = await downloadMediaMessage(message, 'buffer', {});
      const imageBuffer = buffer as Buffer;

      // Get mime type
      const mimeType = message.message?.imageMessage?.mimetype || 'image/jpeg';

      // Upload to Supabase Storage (optional)
      let proofImagePath: string | undefined;
      try {
        const supabase = getSupabase();
        const filename = `${user.id}/${Date.now()}.jpg`;
        const { data: uploadData } = await supabase.storage
          .from('receipts')
          .upload(filename, imageBuffer, { contentType: mimeType });
        
        if (uploadData) {
          proofImagePath = uploadData.path;
        }
      } catch (uploadError) {
        console.warn('[WA] Image upload failed:', uploadError);
      }

      // Analyze with AI
      const extraction = await aiService.analyzeImage(imageBuffer, mimeType);

      if (extraction.amount === 0) {
        await sock.sendMessage(jid, {
          text: `⚠️ Tidak bisa membaca nominal dari gambar.

Coba ketik manual:
• "masuk 50rb jual sayur"
• "keluar 20rb beli makan"`,
        });
        return;
      }

      // Create transaction
      const transaction = await transactionService.create({
        userId: user.id,
        type: extraction.type,
        amount: extraction.amount,
        category: extraction.category,
        description: caption || extraction.description,
        proofImagePath,
      });

      const emoji = extraction.type === 'INCOME' ? '💰' : '💸';
      const typeText = extraction.type === 'INCOME' ? 'Masuk' : 'Keluar';
      const confidence = Math.round(extraction.confidence * 100);

      await sock.sendMessage(jid, {
        text: `${emoji} *${typeText} Bos!* (#${transaction.daily_id})

💵 ${this.formatCurrency(extraction.amount)}
📁 ${extraction.category}
📝 ${extraction.description}
🎯 Akurasi: ${confidence}%

Ketik "hapus #${transaction.daily_id}" untuk membatalkan.`,
      });
    } catch (error) {
      console.error('[WA] Image handling error:', error);
      await sock.sendMessage(jid, {
        text: '❌ Gagal memproses gambar. Silakan coba lagi atau ketik manual.',
      });
    }
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  }
}

export const transactionHandler = new TransactionHandler();
