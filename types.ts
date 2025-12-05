export interface Transaction {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  type: 'income' | 'expense';
  status: 'completed' | 'pending' | 'failed';
}

export interface StatMetric {
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  iconName: 'Wallet' | 'TrendingUp' | 'TrendingDown' | 'Activity';
}