'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  type AuthSession,
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
    updateSession: (session: AuthSession) => void;
  }) => ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const { session, loading, login, register, logout, updateSession, isAuthenticated } =
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
      <main
        className="flex min-h-screen items-center justify-center px-4"
        style={{ background: 'var(--ui-bg)' }}
      >
        <div
          className="w-full max-w-md rounded-2xl border p-8"
          style={{
            background: 'var(--ui-panel-solid)',
            borderColor: 'var(--ui-border)',
            color: 'var(--ui-fg)',
            boxShadow: 'var(--ui-shadow)',
          }}
        >
          <h1 className="text-2xl font-bold">OCraft</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--ui-fg-muted)' }}>
            登录后进入 3D 场景与剧情包
          </p>
          
          <div
            className="mt-6 flex gap-2 rounded-lg p-1"
            style={{ background: 'var(--ui-bg)' }}
          >
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                mode === 'login' ? '' : ''
              }`}
              style={
                mode === 'login'
                  ? {
                      background: 'var(--ui-panel-solid)',
                      color: 'var(--ui-fg)',
                      boxShadow: 'var(--ui-shadow)',
                    }
                  : { color: 'var(--ui-fg-muted)' }
              }
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className="flex-1 rounded-md px-3 py-2 text-sm font-medium transition"
              style={
                mode === 'register'
                  ? {
                      background: 'var(--ui-panel-solid)',
                      color: 'var(--ui-fg)',
                      boxShadow: 'var(--ui-shadow)',
                    }
                  : { color: 'var(--ui-fg-muted)' }
              }
            >
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm" style={{ color: 'var(--ui-fg-muted)' }}>
                用户名
              </span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="mt-1 w-full rounded-lg border px-3 py-2 outline-none"
                style={{
                  background: 'var(--ui-input)',
                  borderColor: 'var(--ui-border)',
                  color: 'var(--ui-fg)',
                }}
                placeholder="中文、字母、数字、下划线，2–32 位"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm" style={{ color: 'var(--ui-fg-muted)' }}>
                密码
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
                className="mt-1 w-full rounded-lg border px-3 py-2 outline-none"
                style={{
                  background: 'var(--ui-input)',
                  borderColor: 'var(--ui-border)',
                  color: 'var(--ui-fg)',
                }}
                placeholder="至少 6 位"
                required
                minLength={6}
              />
            </label>

            {error && (
              <p
                className="rounded-lg px-3 py-2 text-sm"
                style={{ color: 'var(--ui-danger)' }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
              style={{
                background: 'var(--ui-accent)',
                color: 'var(--ui-accent-fg)',
              }}
            >
              {submitting
                ? '请稍候…'
                : mode === 'login'
                  ? '登录并进入游戏'
                  : '注册并进入游戏'}
            </button>
          </form>
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
        updateSession,
      })}
    </>
  );
}
