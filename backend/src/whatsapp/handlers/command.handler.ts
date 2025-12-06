import { WASocket } from 'baileys';
import { transactionService } from '../../services/transaction.service.js';

interface UserRecord {
  id: string;
  wa_number: string;
}

class CommandHandler {
  async handleDelete(
    sock: WASocket,
    jid: string,
    user: UserRecord,
    dailyId: number
  ): Promise<void> {
    try {
      // Get transaction first to show what was deleted
      const transaction = await transactionService.getByDailyId(dailyId, user.id);

      if (!transaction) {
        await sock.sendMessage(jid, {
          text: `❌ Transaksi #${dailyId} tidak ditemukan hari ini.`,
        });
        return;
      }

      // Delete transaction
      const deleted = await transactionService.deleteByDailyId(dailyId, user.id);

      if (!deleted) {
        await sock.sendMessage(jid, {
          text: `❌ Gagal menghapus transaksi #${dailyId}.`,
        });
        return;
      }

      const emoji = transaction.type === 'INCOME' ? '💰' : '💸';

      await sock.sendMessage(jid, {
        text: `🗑️ *Transaksi Dihapus!*

${emoji} #${dailyId} - ${this.formatCurrency(Number(transaction.amount))}
📁 ${transaction.category}
📝 ${transaction.description || '-'}

Transaksi sudah dibatalkan.`,
      });
    } catch (error) {
      console.error('[WA] Delete transaction error:', error);
      await sock.sendMessage(jid, {
        text: '❌ Gagal menghapus transaksi. Silakan coba lagi.',
      });
    }
  }

  async handleEdit(
    sock: WASocket,
    jid: string,
    user: UserRecord,
    dailyId: number,
    newAmount?: number,
    newDescription?: string
  ): Promise<void> {
    try {
      // Get transaction first
      const transaction = await transactionService.getByDailyId(dailyId, user.id);

      if (!transaction) {
        await sock.sendMessage(jid, {
          text: `❌ Transaksi #${dailyId} tidak ditemukan hari ini.`,
        });
        return;
      }

      // Prepare updates
      const updates: { amount?: number; description?: string } = {};
      if (newAmount !== undefined) updates.amount = newAmount;
      if (newDescription !== undefined) updates.description = newDescription;

      if (Object.keys(updates).length === 0) {
        await sock.sendMessage(jid, {
          text: `⚠️ Tidak ada perubahan yang dilakukan.`,
        });
        return;
      }

      // Update transaction
      const updated = await transactionService.update(transaction.id, user.id, updates);

      if (!updated) {
        await sock.sendMessage(jid, {
          text: `❌ Gagal mengubah transaksi #${dailyId}.`,
        });
        return;
      }

      const emoji = updated.type === 'INCOME' ? '💰' : '💸';

      let changeText = '';
      if (newAmount !== undefined) {
        changeText += `💵 ${this.formatCurrency(Number(transaction.amount))} → ${this.formatCurrency(newAmount)}\n`;
      }
      if (newDescription !== undefined) {
        changeText += `📝 "${transaction.description || '-'}" → "${newDescription}"\n`;
      }

      await sock.sendMessage(jid, {
        text: `✏️ *Transaksi Diubah!*

${emoji} #${dailyId}
${changeText}
Perubahan berhasil disimpan.`,
      });
    } catch (error) {
      console.error('[WA] Edit transaction error:', error);
      await sock.sendMessage(jid, {
        text: '❌ Gagal mengubah transaksi. Silakan coba lagi.',
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

export const commandHandler = new CommandHandler();
