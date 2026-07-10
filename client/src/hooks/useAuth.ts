'use client';

import type { AuthSession } from '@ocraft/shared';
import { useCallback, useEffect, useState } from 'react';
import {
  clearAuthSession,
  getAuthSession,
  loginAccount,
  registerAccount,
  setAuthSession,
  validateAuthSession,
} from '@/lib/auth';

export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const stored = getAuthSession();
      if (!stored) {
        if (!cancelled) {
          setSession(null);
          setLoading(false);
        }
        return;
      }

      const valid = await validateAuthSession(stored);
      if (!cancelled) {
        setSession(valid);
        setLoading(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const next = await loginAccount(username, password);
    setSession(next);
    return next;
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const next = await registerAccount(username, password);
    setSession(next);
    return next;
  }, []);

  const logout = useCallback(() => {
    clearAuthSession();
    setSession(null);
  }, []);

  const updateSession = useCallback((next: AuthSession) => {
    setAuthSession(next);
    setSession(next);
  }, []);

  return {
    session,
    loading,
    login,
    register,
    logout,
    updateSession,
    isAuthenticated: session !== null,
  };
}
