import React from 'react';
import { ArrowUpRight, ArrowDownRight, MoreHorizontal, FileText, ShoppingBag, Coffee, Zap, Trash2 } from 'lucide-react';
import { Transaction } from '../services/api';

interface TransactionTableProps {
  transactions: Transaction[];
  onDelete?: (id: string) => void;
}

const CategoryIcon = ({ category }: { category: string }) => {
  switch (category.toLowerCase()) {
    case 'penjualan': return <ShoppingBag className="h-4 w-4" />;
    case 'bahan baku': return <Coffee className="h-4 w-4" />;
    case 'operasional': return <Zap className="h-4 w-4" />;
    default: return <FileText className="h-4 w-4" />;
  }
};

export const TransactionTable: React.FC<TransactionTableProps> = ({ transactions, onDelete }) => {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
        <div className="text-gray-400 mb-3">
          <ArrowUpRight className="h-12 w-12 mx-auto" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">Belum ada transaksi</h3>
        <p className="text-gray-500 mt-1">Catat transaksi pertamamu via WhatsApp</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
        <h3 className="font-display text-lg font-bold text-gray-900">Transaksi Terakhir</h3>
        <button className="text-sm font-medium text-emerald-700 hover:text-emerald-800 transition-colors">
          Lihat Semua
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-6 py-3 font-semibold">Transaksi</th>
              <th className="px-6 py-3 font-semibold">Kategori</th>
              <th className="px-6 py-3 font-semibold">Tanggal</th>
              <th className="px-6 py-3 font-semibold text-right">Jumlah</th>
              <th className="px-6 py-3 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {transactions.map((tx) => (
              <tr key={tx.id} className="group transition-colors hover:bg-gray-50/80">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg border border-gray-100 ${
                      tx.type === 'INCOME' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {tx.type === 'INCOME' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{tx.description || 'Transaksi'}</p>
                      <p className="text-xs text-gray-500 md:hidden">{formatDate(tx.transaction_date)}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600">
                  <div className="flex items-center gap-2">
                    <CategoryIcon category={tx.category} />
                    <span>{tx.category}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-500 font-mono text-xs">{formatDate(tx.transaction_date)}</td>
                <td className={`px-6 py-4 text-right font-mono font-medium ${
                  tx.type === 'INCOME' ? 'text-emerald-700' : 'text-gray-900'
                }`}>
                  {tx.type === 'INCOME' ? '+' : '-'} Rp {tx.amount.toLocaleString('id-ID')}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {onDelete && (
                      <button
                        onClick={() => onDelete(tx.id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                        title="Hapus"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <button className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
