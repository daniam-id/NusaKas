import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { authApi, User } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isInitialized: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if token is expired (JWT token structure: header.payload.signature)
  const isTokenExpired = useCallback((token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp && payload.exp < currentTime;
    } catch {
      return true; // If we can't parse, consider it expired
    }
  }, []);

  // Clear scheduled refresh
  const clearRefreshTimer = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  }, []);

  // Schedule token refresh (5 minutes before expiration)
  const scheduleTokenRefresh = useCallback((token: string) => {
    clearRefreshTimer();
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000; // Convert to milliseconds
      const refreshTime = expirationTime - (5 * 60 * 1000); // 5 minutes before expiration
      const timeUntilRefresh = refreshTime - Date.now();

      if (timeUntilRefresh > 0) {
        refreshTimeoutRef.current = setTimeout(() => {
          refreshAuth();
        }, timeUntilRefresh);
      }
    } catch {
      // If we can't parse the token, don't schedule refresh
    }
  }, [clearRefreshTimer]);

  // Refresh authentication
  const refreshAuth = useCallback(async () => {
    try {
      const res = await authApi.me();
      setUser(res.data.data.user);
    } catch (error) {
      // If refresh fails, logout
      logout();
    }
  }, []);

  const initializeAuth = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        
        // Check if token is expired
        if (isTokenExpired(storedToken)) {
          logout();
        } else {
          // Validate token with server
          await refreshAuth();
          scheduleTokenRefresh(storedToken);
        }
      }
    } catch (error) {
      // If anything fails, clear auth state
      logout();
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, [isTokenExpired, refreshAuth, scheduleTokenRefresh]);

  useEffect(() => {
    initializeAuth();
    
    return () => {
      clearRefreshTimer();
    };
  }, [initializeAuth, clearRefreshTimer]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    scheduleTokenRefresh(newToken);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    clearRefreshTimer();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user && isInitialized,
        isInitialized,
        login,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
