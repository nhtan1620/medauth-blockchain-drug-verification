import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from './api';
import type { AuthUser } from './types';

const SESSION_KEY = 'medauth.session.v1';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  requestOtp: (identifier: string) => Promise<{ devCode?: string }>;
  verifyOtp: (identifier: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(SESSION_KEY);
      if (raw) {
        const session = JSON.parse(raw) as { token: string; user: AuthUser };
        setToken(session.token);
        setUser(session.user);
      }
      setIsLoading(false);
    })();
  }, []);

  const requestOtp = useCallback(async (identifier: string) => {
    const res = await authApi.requestOtp(identifier);
    return { devCode: res.devCode };
  }, []);

  const verifyOtp = useCallback(async (identifier: string, code: string) => {
    const res = await authApi.verifyOtp(identifier, code);
    setToken(res.token);
    setUser(res.user);
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(res));
  }, []);

  const signOut = useCallback(async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem(SESSION_KEY);
  }, []);

  const value = useMemo(
    () => ({ user, token, isLoading, requestOtp, verifyOtp, signOut }),
    [user, token, isLoading, requestOtp, verifyOtp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
