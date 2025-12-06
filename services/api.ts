import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Production API Configuration
const CLOUDFLARE_API_URL = 'https://meant-serves-voting-catalog.trycloudflare.com/api';

// Fixed API endpoint selection - Cloudflare only
const getApiBaseUrl = () => {
    console.log('[DEBUG] 🌐 Using Cloudflare API endpoint exclusively');
    console.log('[DEBUG] API_BASE_URL:', CLOUDFLARE_API_URL);
    return CLOUDFLARE_API_URL;
};

const API_BASE_URL = getApiBaseUrl();

// Export endpoint configuration for external use
export const API_ENDPOINTS = {
    PRODUCTION: CLOUDFLARE_API_URL,
    CURRENT: API_BASE_URL
} as const;

/**
 * Production API Configuration
 * 
 * Using Cloudflare production endpoint exclusively:
 * - PRODUCTION: https://meant-serves-voting-catalog.trycloudflare.com/api
 * 
 * This configuration is fixed for production deployment.
 * No local development endpoint available.
 */

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle 401 errors with refresh attempt
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;
    
    // If it's a 401 error and we haven't tried refreshing yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Try to refresh the token
        const refreshResponse = await authApi.refresh();
        
        if (refreshResponse.data.success) {
          const { token, user } = refreshResponse.data.data;
          
          // Update stored token and user
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
          
          // Update the authorization header
          originalRequest.headers.Authorization = `Bearer ${token}`;
          
          // Retry the original request
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  // Check if user is registered (has PIN)
  checkUser: (wa_number: string) => {
    console.log('[DEBUG] checkUser called with:', wa_number);
    console.log('[DEBUG] Making request to:', `${API_BASE_URL}/auth/check-user`);
    return api.post<{ success: boolean; data: { is_registered: boolean } }>('/auth/check-user', { wa_number });
  },

  // Login with PIN (for registered users)
  login: (wa_number: string, pin: string) =>
    api.post<{ success: boolean; data: { token: string; user: User } }>('/auth/login', { wa_number, pin }),

  // Registration flow - Step 1: Send OTP
  sendOtp: (wa_number: string) =>
    api.post<{ success: boolean; data: { wa_number: string; expires_at: string; otp?: string } }>('/auth/register/send-otp', { wa_number }),

  // Registration flow - Step 2: Verify OTP
  verifyOtp: (wa_number: string, code: string) =>
    api.post<{ success: boolean; data: { temp_token: string } }>('/auth/register/verify-otp', { wa_number, code }),

  // Registration flow - Step 3: Complete registration with store name and PIN
  completeRegistration: (temp_token: string, store_name: string, pin: string, owner_name?: string) =>
    api.post<{ success: boolean; data: { token: string; user: User } }>('/auth/register/complete', {
      temp_token,
      store_name,
      pin,
      owner_name,
    }),

  // Legacy verify (for backward compatibility)
  verify: (wa_number: string, code: string) =>
    api.post<{ success: boolean; data: { token: string; user: User } }>('/auth/verify', { wa_number, code }),

  me: () =>
    api.get<{ success: boolean; data: { user: User } }>('/auth/me'),

  refresh: () =>
    api.post<{ success: boolean; data: { token: string; user: User } }>('/auth/refresh'),
};

// Stats API
export const statsApi = {
  get: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return api.get<{ success: boolean; data: StatsResponse }>(`/stats?${params}`);
  },
};

// Transactions API
export const transactionsApi = {
  list: (page = 1, limit = 20, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return api.get<{ success: boolean; data: Transaction[]; meta: { page: number; limit: number; total: number } }>(`/transactions?${params}`);
  },
  
  delete: (id: string) => 
    api.delete<{ success: boolean }>(`/transactions/${id}`),
};

// Report API
export const reportApi = {
  downloadUrl: (startDate: string, endDate: string) => 
    `${API_BASE_URL}/report/download?startDate=${startDate}&endDate=${endDate}&token=${localStorage.getItem('token')}`,
};

// Types
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
