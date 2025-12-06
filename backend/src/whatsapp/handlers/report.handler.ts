import { WASocket } from '@whiskeysockets/baileys';
import { transactionService } from '../../services/transaction.service.js';
import { reportService } from '../../services/report.service.js';

interface UserRecord {
  id: string;
  wa_number: string;
  store_name?: string;
}

class ReportHandler {
  async handleBalance(sock: WASocket, jid: string, user: UserRecord): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const stats = await transactionService.getStats(user.id, today, today);

      await sock.sendMessage(jid, {
        text: `📊 *Saldo Hari Ini*

💰 Pemasukan: ${this.formatCurrency(stats.income)}
💸 Pengeluaran: ${this.formatCurrency(stats.expense)}
━━━━━━━━━━━━━━━
💵 *Saldo: ${this.formatCurrency(stats.balance)}*

Ketik "laporan" untuk detail transaksi.`,
      });
    } catch (error) {
      console.error('[WA] Balance error:', error);
      await sock.sendMessage(jid, {
        text: '❌ Gagal mengambil saldo. Silakan coba lagi.',
      });
    }
  }

  async handleDailyReport(sock: WASocket, jid: string, user: UserRecord): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get stats
      const stats = await transactionService.getStats(user.id, today, today);
      
      // Get transactions
      const result = await transactionService.list({
        userId: user.id,
        startDate: today,
        endDate: today,
        limit: 20,
      });

      let message = `📋 *Laporan Hari Ini*\n${this.formatDate(today)}\n\n`;

      if (result.data.length === 0) {
        message += `Belum ada transaksi hari ini.\n`;
      } else {
        // Group by type
        const incomes = result.data.filter(t => t.type === 'INCOME');
        const expenses = result.data.filter(t => t.type === 'EXPENSE');

        if (incomes.length > 0) {
          message += `💰 *Pemasukan*\n`;
          for (const tx of incomes) {
            message += `  #${tx.daily_id} ${this.formatCurrency(Number(tx.amount))} - ${tx.description || tx.category}\n`;
          }
          message += `\n`;
        }

        if (expenses.length > 0) {
          message += `💸 *Pengeluaran*\n`;
          for (const tx of expenses) {
            message += `  #${tx.daily_id} ${this.formatCurrency(Number(tx.amount))} - ${tx.description || tx.category}\n`;
          }
          message += `\n`;
        }
      }

      message += `━━━━━━━━━━━━━━━
💰 Total Masuk: ${this.formatCurrency(stats.income)}
💸 Total Keluar: ${this.formatCurrency(stats.expense)}
💵 *Saldo: ${this.formatCurrency(stats.balance)}*

Ketik "download pdf" untuk unduh laporan.`;

      await sock.sendMessage(jid, { text: message });
    } catch (error) {
      console.error('[WA] Daily report error:', error);
      await sock.sendMessage(jid, {
        text: '❌ Gagal membuat laporan. Silakan coba lagi.',
      });
    }
  }

  async handlePdfDownload(sock: WASocket, jid: string, user: UserRecord): Promise<void> {
    try {
      await sock.sendMessage(jid, { text: '📄 Membuat PDF laporan...' });

      // Generate PDF for current month
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endDate = now.toISOString().split('T')[0];

      const pdfBuffer = await reportService.generatePdf({
        userId: user.id,
        startDate,
        endDate,
        storeName: user.store_name || 'NusaKas',
      });

      const filename = `Laporan_${startDate}_${endDate}.pdf`;

      await sock.sendMessage(jid, {
        document: pdfBuffer,
        fileName: filename,
        mimetype: 'application/pdf',
        caption: `📊 Laporan Keuangan\nPeriode: ${this.formatDate(startDate)} - ${this.formatDate(endDate)}`,
      });
    } catch (error) {
      console.error('[WA] PDF download error:', error);
      await sock.sendMessage(jid, {
        text: '❌ Gagal membuat PDF. Silakan coba lagi.',
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

  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
}

export const reportHandler = new ReportHandler();
