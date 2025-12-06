import PDFDocument from 'pdfkit';
import { transactionService } from './transaction.service.js';

export interface ReportOptions {
  userId: string;
  startDate: string;
  endDate: string;
  storeName?: string;
}

class ReportService {
  async generatePdf(options: ReportOptions): Promise<Buffer> {
    const { userId, startDate, endDate, storeName } = options;

    // Fetch all transactions in date range
    const result = await transactionService.list({
      userId,
      startDate,
      endDate,
      limit: 1000,
    });

    const transactions = result.data;
    const stats = await transactionService.getStats(userId, startDate, endDate);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 50, size: 'A4' });

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text('LAPORAN KEUANGAN', { align: 'center' });
      doc.fontSize(14).font('Helvetica').text(storeName || 'NusaKas', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Periode: ${this.formatDate(startDate)} - ${this.formatDate(endDate)}`, { align: 'center' });
      doc.moveDown(1);

      // Summary Box
      doc.rect(50, doc.y, 495, 80).stroke();
      const summaryY = doc.y + 10;
      
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('RINGKASAN', 60, summaryY);
      doc.moveDown(0.5);
      
      doc.fontSize(10).font('Helvetica');
      doc.text(`Total Pemasukan: ${this.formatCurrency(stats.income)}`, 60, summaryY + 20);
      doc.text(`Total Pengeluaran: ${this.formatCurrency(stats.expense)}`, 60, summaryY + 35);
      doc.font('Helvetica-Bold');
      doc.text(`Saldo: ${this.formatCurrency(stats.balance)}`, 60, summaryY + 50);
      
      doc.y = summaryY + 80;
      doc.moveDown(1);

      // Transactions Table
      if (transactions.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').text('DETAIL TRANSAKSI', 50);
        doc.moveDown(0.5);

        // Table Header
        const tableTop = doc.y;
        const col1 = 50;  // Date
        const col2 = 120; // ID
        const col3 = 160; // Type
        const col4 = 220; // Category
        const col5 = 310; // Description
        const col6 = 450; // Amount

        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Tanggal', col1, tableTop);
        doc.text('#', col2, tableTop);
        doc.text('Tipe', col3, tableTop);
        doc.text('Kategori', col4, tableTop);
        doc.text('Keterangan', col5, tableTop);
        doc.text('Jumlah', col6, tableTop);

        doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

        // Table Rows
        let rowY = tableTop + 25;
        doc.font('Helvetica').fontSize(8);

        for (const tx of transactions) {
          if (rowY > 750) {
            doc.addPage();
            rowY = 50;
          }

          const amountColor = tx.type === 'INCOME' ? '#16a34a' : '#dc2626';
          const prefix = tx.type === 'INCOME' ? '+' : '-';

          doc.fillColor('#000000');
          doc.text(this.formatDate(tx.transaction_date), col1, rowY, { width: 65 });
          doc.text(`#${tx.daily_id}`, col2, rowY, { width: 35 });
          doc.text(tx.type === 'INCOME' ? 'Masuk' : 'Keluar', col3, rowY, { width: 55 });
          doc.text(tx.category || '-', col4, rowY, { width: 85 });
          doc.text((tx.description || '-').slice(0, 25), col5, rowY, { width: 130 });
          
          doc.fillColor(amountColor);
          doc.text(`${prefix}${this.formatCurrency(tx.amount)}`, col6, rowY, { width: 95 });
          doc.fillColor('#000000');

          rowY += 18;
        }
      } else {
        doc.fontSize(10).text('Tidak ada transaksi dalam periode ini.', { align: 'center' });
      }

      // Footer
      doc.fontSize(8).fillColor('#666666');
      doc.text(
        `Dicetak pada: ${new Date().toLocaleString('id-ID')} | NusaKas - Organic Fintech`,
        50,
        780,
        { align: 'center' }
      );

      doc.end();
    });
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
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}

export const reportService = new ReportService();
