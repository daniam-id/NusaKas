import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// API Configuration - Local Development vs Production
const CLOUDFLARE_API_URL = 'https://meant-serves-voting-catalog.trycloudflare.com/api';
const LOCAL_API_URL = 'http://localhost:3000/api';

// Environment-based API endpoint selection
const getApiBaseUrl = () => {
    const isDevelopment = import.meta.env.DEV || import.meta.env.VITE_USE_LOCAL_API === 'true';
    
    if (isDevelopment) {
        console.log('[DEBUG] 🌐 Using local development API endpoint');
        console.log('[DEBUG] API_BASE_URL:', LOCAL_API_URL);
        return LOCAL_API_URL;
    } else {
        console.log('[DEBUG] 🌐 Using production Cloudflare API endpoint');
        console.log('[DEBUG] API_BASE_URL:', CLOUDFLARE_API_URL);
        return CLOUDFLARE_API_URL;
    }
};

const API_BASE_URL = getApiBaseUrl();

// Export endpoint configuration for external use
export const API_ENDPOINTS = {
    LOCAL: LOCAL_API_URL,
    PRODUCTION: CLOUDFLARE_API_URL,
    CURRENT: API_BASE_URL
} as const;

/**
 * API Configuration - Development vs Production
 * 
 * Local Development:
 * - LOCAL: http://localhost:3000/api (used when VITE_USE_LOCAL_API=true or in development mode)
 * 
 * Production:
 * - PRODUCTION: https://meant-serves-voting-catalog.trycloudflare.com/api
 * 
 * The endpoint is automatically selected based on environment:
 * - Development: Uses localhost:3000 for local backend testing
 * - Production: Uses Cloudflare endpoint for deployed application
 * 
 * To force local development endpoint in production build:
 * - Set VITE_USE_LOCAL_API=true in environment variables
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

// Registration API (new flow)
export const registerApi = {
  // Start web registration - generates OTP and verification link
  startWebRegistration: (wa_number: string) =>
    api.post<{
      success: boolean;
      message: string;
      data: {
        otp_id: string;
        expires_at: string;
        verification_link: string;
      };
    }>('/register/web/start', { wa_number }),

  // Verify OTP and get session
  verifyOTP: (wa_number: string, otp_code: string) =>
    api.post<{
      success: boolean;
      message: string;
      data: {
        session_id: string;
        registration_token: string;
      };
    }>('/register/web/verify-otp', { wa_number, otp_code }),

  // Resend OTP
  resendOTP: (wa_number: string) =>
    api.post<{
      success: boolean;
      message: string;
      data: {
        expires_at: string;
      };
    }>('/register/web/resend-otp', { wa_number }),

  // Get session data
  getSession: (session_id: string) =>
    api.get<{
      success: boolean;
      data: {
        id: string;
        current_step: string;
        status: string;
        collected_data: {
          store_name: string | null;
          owner_name: string | null;
          has_pin: boolean;
        };
        expires_at: string;
      };
    }>(`/register/session/${session_id}`),

  // Update session data
  updateSession: (session_id: string, data: { store_name?: string; owner_name?: string; pin?: string }) =>
    api.patch<{
      success: boolean;
      message: string;
      data: {
        is_complete: boolean;
      };
    }>(`/register/session/${session_id}`, data),

  // Complete registration
  completeRegistration: (session_id: string, data?: { store_name?: string; owner_name?: string; pin?: string }) =>
    api.post<{
      success: boolean;
      message: string;
      data: {
        user: {
          id: string;
          wa_number: string;
          store_name: string;
          owner_name: string;
        };
        token: string;
      };
    }>('/register/complete', { session_id, ...data }),

  // Initiate hybrid flow
  initiateHybrid: (wa_number: string, direction: 'web_to_whatsapp' | 'whatsapp_to_web') =>
    api.post<{
      success: boolean;
      message: string;
      data: {
        link: string;
        otp_code: string;
        expires_at: string;
      };
    }>('/register/hybrid/initiate', { wa_number, direction }),

  // Check registration status
  getStatus: (wa_number: string) =>
    api.get<{
      success: boolean;
      data: {
        isComplete: boolean;
        hasUser: boolean;
        hasSession: boolean;
        missingFields: string[];
        canComplete: boolean;
      };
    }>(`/register/status?wa_number=${encodeURIComponent(wa_number)}`),

  // Check OTP status
  checkOTPStatus: (wa_number: string) =>
    api.get<{
      success: boolean;
      data: {
        hasPending: boolean;
        expiresAt?: string;
        attemptsRemaining?: number;
      };
    }>(`/register/otp-status?wa_number=${encodeURIComponent(wa_number)}`),
};

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

  // Registration flow - Step 1: Send OTP (returns WhatsApp deep link)
  sendOtp: (wa_number: string) =>
    api.post<{ 
      success: boolean; 
      data: { 
        wa_number: string; 
        wa_link: string;
        expires_at: string; 
        is_new_user: boolean;
        otp?: string;
      } 
    }>('/auth/register/send-otp', { wa_number }),

  // Registration flow - Step 1.5: Check verification status (polling)
  checkVerificationStatus: (wa_number: string) =>
    api.post<{ 
      success: boolean; 
      message: string;
      data?: { 
        token: string; 
        user: User;
        wa_number: string;
      } 
    }>('/auth/register/check-status', { wa_number }),

  // Registration flow - Step 2: Verify OTP (legacy - kept for manual entry)
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
