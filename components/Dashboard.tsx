import React, { useState, useEffect } from 'react';
import { Navbar } from './Navbar';
import { StatsCard } from './StatsCard';
import { TransactionTable } from './TransactionTable';
import { ReportModal } from './ReportModal';
import { statsApi, transactionsApi, StatsResponse, Transaction } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Download, Loader2 } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const [statsRes, txRes] = await Promise.all([
        statsApi.get(),
        transactionsApi.list(1, 20),
      ]);
      
      setStats(statsRes.data.data);
      setTransactions(txRes.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Gagal memuat data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm('Hapus transaksi ini?')) return;
    
    try {
      await transactionsApi.delete(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
      // Refresh stats
      const statsRes = await statsApi.get();
      setStats(statsRes.data.data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Gagal menghapus transaksi');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAF5]">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
            <p className="mt-2 text-gray-600">Memuat data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAF5] font-sans text-gray-900">
      <Navbar />

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-emerald-950 sm:text-5xl">
              Halo, {user?.full_name || 'Juragan'}!
            </h1>
            <p className="mt-3 max-w-lg text-lg text-gray-600 leading-relaxed">
              Monitor arus kas warungmu hari ini. Data real-time untuk keputusan bisnis yang lebih baik.
            </p>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={() => setShowReportModal(true)}
              className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-gray-700 border border-gray-200 shadow-sm transition-all hover:bg-gray-50 hover:border-gray-300 active:scale-95"
            >
              <Download className="h-4 w-4" />
              Download Laporan
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 border border-red-100">
            {error}
            <button onClick={fetchData} className="ml-2 underline">Coba lagi</button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <StatsCard
            stat={{
              label: 'Total Saldo',
              value: formatCurrency(stats?.balance || 0),
              iconName: 'Wallet',
              trend: (stats?.balance || 0) >= 0 ? 'up' : 'down',
            }}
          />
          <StatsCard
            stat={{
              label: 'Pemasukan',
              value: formatCurrency(stats?.income || 0),
              iconName: 'TrendingUp',
              trend: 'up',
            }}
          />
          <StatsCard
            stat={{
              label: 'Pengeluaran',
              value: formatCurrency(stats?.expense || 0),
              iconName: 'TrendingDown',
              trend: 'down',
            }}
          />
        </div>

        {/* Transactions Table */}
        <div className="grid gap-6">
          <TransactionTable 
            transactions={transactions} 
            onDelete={handleDeleteTransaction}
          />
        </div>

        {/* Tips */}
        <div className="mt-8 rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 rounded-full bg-emerald-50 p-3">
              <span className="text-xl">💡</span>
            </div>
            <div>
              <h4 className="text-base font-semibold text-emerald-900">Tips Hari Ini</h4>
              <p className="mt-1 text-sm text-gray-600">
                Catat transaksi via WhatsApp dengan ketik "masuk 50rb" atau "keluar 20rb makan".
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Report Modal */}
      {showReportModal && (
        <ReportModal onClose={() => setShowReportModal(false)} />
      )}
    </div>
  );
};
