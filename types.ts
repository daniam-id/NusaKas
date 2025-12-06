export interface Transaction {
  id: string;
  daily_id: number;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  description: string | null;
  transaction_date: string;
  proof_image_path: string | null;
  created_at: string;
}

export interface StatMetric {
  label: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  iconName: 'Wallet' | 'TrendingUp' | 'TrendingDown' | 'Activity';
}

export interface User {
  id: string;
  wa_number: string;
  full_name: string;
}

export interface StatsResponse {
  income: number;
  expense: number;
  balance: number;
}
