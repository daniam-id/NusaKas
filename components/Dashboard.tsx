import React from 'react';
import { Navbar } from './Navbar';
import { StatsCard } from './StatsCard';
import { TransactionTable } from './TransactionTable';
import { StatMetric, Transaction } from '../types';
import { Plus, Download } from 'lucide-react';

const mockStats: StatMetric[] = [
  {
    label: 'Total Saldo',
    value: 'Rp 42.500.000',
    change: '12.5%',
    trend: 'up',
    iconName: 'Wallet',
  },
  {
    label: 'Pemasukan',
    value: 'Rp 18.200.000',
    change: '8.2%',
    trend: 'up',
    iconName: 'TrendingUp',
  },
  {
    label: 'Pengeluaran',
    value: 'Rp 4.300.000',
    change: '2.1%',
    trend: 'down', // Good trend for expenses
    iconName: 'TrendingDown',
  },
];

const mockTransactions: Transaction[] = [
  { id: '1', description: 'Penjualan Harian', category: 'Penjualan', amount: 2500000, date: '24 Okt 2023', type: 'income', status: 'completed' },
  { id: '2', description: 'Beli Stok Beras', category: 'Bahan Baku', amount: 850000, date: '23 Okt 2023', type: 'expense', status: 'completed' },
  { id: '3', description: 'Service AC Warung', category: 'Operasional', amount: 350000, date: '22 Okt 2023', type: 'expense', status: 'pending' },
  { id: '4', description: 'Penjualan Catering', category: 'Penjualan', amount: 4200000, date: '21 Okt 2023', type: 'income', status: 'completed' },
  { id: '5', description: 'Tagihan Listrik', category: 'Operasional', amount: 450000, date: '20 Okt 2023', type: 'expense', status: 'failed' },
];

export const Dashboard: React.FC = () => {
  return (
    // Main Background: #F8FAF5 (Very subtle organic tint) to reduce glare vs pure white
    <div className="min-h-screen bg-[#F8FAF5] font-sans text-gray-900">
      
      <Navbar />

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        
        {/* Hero Section */}
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-emerald-950 sm:text-5xl">
              Halo, Juragan!
            </h1>
            <p className="mt-3 max-w-lg text-lg text-gray-600 leading-relaxed">
              Monitor arus kas warungmu hari ini. Data real-time untuk keputusan bisnis yang lebih baik.
            </p>
          </div>
          
          <div className="flex gap-3">
            <button className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-gray-700 border border-gray-200 shadow-sm transition-all hover:bg-gray-50 hover:border-gray-300 active:scale-95">
              <Download className="h-4 w-4" />
              Laporan
            </button>
            <button className="flex items-center gap-2 rounded-xl bg-[#31694E] px-6 py-3 text-sm font-bold text-white shadow-md shadow-emerald-900/10 transition-all hover:bg-[#27543f] active:scale-95">
              <Plus className="h-5 w-5" />
              Catat Transaksi
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {mockStats.map((stat) => (
            <StatsCard key={stat.label} stat={stat} />
          ))}
        </div>

        {/* Main Content Area */}
        <div className="grid gap-6">
          <div className="lg:col-span-3">
            <TransactionTable transactions={mockTransactions} />
          </div>
        </div>

        {/* Quick Tips / Ergonomic Footer Section */}
        <div className="mt-8 rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 rounded-full bg-emerald-50 p-3">
              <span className="text-xl">💡</span>
            </div>
            <div>
              <h4 className="text-base font-semibold text-emerald-900">Tips Hari Ini</h4>
              <p className="mt-1 text-sm text-gray-600">
                Optimalkan stok bahan baku sebelum akhir pekan untuk menghindari lonjakan harga pasar.
              </p>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
};