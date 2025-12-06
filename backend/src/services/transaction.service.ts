import { getSupabase } from '../config/supabase.js';
import type { Transaction, StatsResponse } from '../types/index.js';

export interface CreateTransactionInput {
  userId: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  category?: string;
  description?: string;
  transactionDate?: string;
  proofImagePath?: string;
}

export interface TransactionFilters {
  userId: string;
  page?: number;
  limit?: number;
  type?: 'INCOME' | 'EXPENSE';
  startDate?: string;
  endDate?: string;
  category?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class TransactionService {
  async create(input: CreateTransactionInput): Promise<Transaction> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: input.userId,
        type: input.type,
        amount: input.amount,
        category: input.category || 'Lainnya',
        description: input.description || null,
        transaction_date: input.transactionDate || new Date().toISOString().split('T')[0],
        proof_image_path: input.proofImagePath || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create transaction: ${error.message}`);
    }

    return data as Transaction;
  }

  async createMultiple(inputs: CreateTransactionInput[]): Promise<Transaction[]> {
    const supabase = getSupabase();

    const records = inputs.map(input => ({
      user_id: input.userId,
      type: input.type,
      amount: input.amount,
      category: input.category || 'Lainnya',
      description: input.description || null,
      transaction_date: input.transactionDate || new Date().toISOString().split('T')[0],
      proof_image_path: input.proofImagePath || null,
    }));

    const { data, error } = await supabase
      .from('transactions')
      .insert(records)
      .select();

    if (error) {
      throw new Error(`Failed to create transactions: ${error.message}`);
    }

    return data as Transaction[];
  }

  async getById(id: string, userId: string): Promise<Transaction | null> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      return null;
    }

    return data as Transaction;
  }

  async getByDailyId(dailyId: number, userId: string, date?: string): Promise<Transaction | null> {
    const supabase = getSupabase();
    const targetDate = date || new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('daily_id', dailyId)
      .eq('user_id', userId)
      .eq('transaction_date', targetDate)
      .single();

    if (error) {
      return null;
    }

    return data as Transaction;
  }

  async list(filters: TransactionFilters): Promise<PaginatedResult<Transaction>> {
    const supabase = getSupabase();
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 10, 100);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', filters.userId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters.type) {
      query = query.eq('type', filters.type);
    }
    if (filters.startDate) {
      query = query.gte('transaction_date', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('transaction_date', filters.endDate);
    }
    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to list transactions: ${error.message}`);
    }

    const total = count || 0;

    return {
      data: (data || []) as Transaction[],
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getStats(userId: string, startDate?: string, endDate?: string): Promise<StatsResponse> {
    const supabase = getSupabase();

    let query = supabase
      .from('transactions')
      .select('type, amount')
      .eq('user_id', userId);

    if (startDate) {
      query = query.gte('transaction_date', startDate);
    }
    if (endDate) {
      query = query.lte('transaction_date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get stats: ${error.message}`);
    }

    const transactions = data || [];
    let income = 0;
    let expense = 0;

    for (const tx of transactions) {
      if (tx.type === 'INCOME') {
        income += Number(tx.amount);
      } else {
        expense += Number(tx.amount);
      }
    }

    return {
      income,
      expense,
      balance: income - expense,
    };
  }

  async update(
    id: string,
    userId: string,
    updates: Partial<Pick<Transaction, 'amount' | 'category' | 'description'>>
  ): Promise<Transaction | null> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return null;
    }

    return data as Transaction;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const supabase = getSupabase();

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    return !error;
  }

  async deleteByDailyId(dailyId: number, userId: string, date?: string): Promise<boolean> {
    const supabase = getSupabase();
    const targetDate = date || new Date().toISOString().split('T')[0];

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('daily_id', dailyId)
      .eq('user_id', userId)
      .eq('transaction_date', targetDate);

    return !error;
  }
}

export const transactionService = new TransactionService();
