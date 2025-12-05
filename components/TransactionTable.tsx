import React from 'react';
import { Transaction } from '../types';
import { ArrowUpRight, ArrowDownRight, MoreHorizontal, FileText, ShoppingBag, Coffee, Zap } from 'lucide-react';

interface TransactionTableProps {
  transactions: Transaction[];
}

const CategoryIcon = ({ category }: { category: string }) => {
  switch (category.toLowerCase()) {
    case 'penjualan': return <ShoppingBag className="h-4 w-4" />;
    case 'bahan baku': return <Coffee className="h-4 w-4" />;
    case 'operasional': return <Zap className="h-4 w-4" />;
    default: return <FileText className="h-4 w-4" />;
  }
};

export const TransactionTable: React.FC<TransactionTableProps> = ({ transactions }) => {
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
              <th className="px-6 py-3 font-semibold">Status</th>
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
                      tx.type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {tx.type === 'income' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{tx.description}</p>
                      <p className="text-xs text-gray-500 md:hidden">{tx.date}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600">
                  <div className="flex items-center gap-2">
                    <CategoryIcon category={tx.category} />
                    <span>{tx.category}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-500 font-mono text-xs">{tx.date}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                    tx.status === 'completed' 
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                      : tx.status === 'pending'
                      ? 'bg-yellow-50 border-yellow-100 text-yellow-800'
                      : 'bg-red-50 border-red-100 text-red-800'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      tx.status === 'completed' ? 'bg-emerald-500' : tx.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}></span>
                    {tx.status === 'completed' ? 'Berhasil' : tx.status === 'pending' ? 'Proses' : 'Gagal'}
                  </span>
                </td>
                <td className={`px-6 py-4 text-right font-mono font-medium ${
                  tx.type === 'income' ? 'text-emerald-700' : 'text-gray-900'
                }`}>
                  {tx.type === 'income' ? '+' : '-'} Rp {tx.amount.toLocaleString('id-ID')}
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-gray-400 hover:text-gray-900 transition-colors">
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};