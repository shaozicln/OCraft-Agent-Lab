'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  formatAuthValidationError,
  loginPayloadSchema,
  registerPayloadSchema,
} from '@ocraft/shared';
import { useAuth } from '@/hooks/useAuth';

interface AuthGateProps {
  children: (ctx: {
    username: string;
    playerId: string;
    token: string;
    logout: () => void;
  }) => ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const { session, loading, login, register, logout, isAuthenticated } =
    useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const schema = mode === 'login' ? loginPayloadSchema : registerPayloadSchema;
    const validated = schema.safeParse({ username, password });
    if (!validated.success) {
      setError(formatAuthValidationError(validated.error));
      setSubmitting(false);
      return;
    }

    try {
      if (mode === 'login') {
        await login(username, password);
      } else {
        await register(username, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-gray-500">
        正在验证登录状态…
      </main>
    );
  }

  if (!isAuthenticated || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">OCraft 办公室篇</h1>
          
          <div className="mt-6 flex gap-2 rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                mode === 'login'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                mode === 'register'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm text-gray-600">用户名</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="中文、字母、数字、下划线，2–32 位"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm text-gray-600">密码</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="至少 6 位"
                required
                minLength={6}
              />
            </label>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting
                ? '请稍候…'
                : mode === 'login'
                  ? '登录并进入游戏'
                  : '注册并进入游戏'}
            </button>
          </form>

          <p className="mt-4 text-xs text-gray-400">
            同一用户名在任何设备登录都会加载同一份进度。
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      {children({
        username: session.username,
        playerId: session.playerId,
        token: session.token,
        logout,
      })}
    </>
  );
}
