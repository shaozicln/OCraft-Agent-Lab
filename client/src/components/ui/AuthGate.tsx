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
import { ScreenState } from './ScreenState';

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
  const [showRecoverHint, setShowRecoverHint] = useState(false);

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
    return <ScreenState kind="loading" title="正在确认登录状态" />;
  }

  if (!isAuthenticated || !session) {
    return (
      <main className="oc-screen">
        <div className="oc-card w-full max-w-md p-8 text-left">
          <h1 className="text-2xl font-semibold tracking-tight">OCraft</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--ui-fg-muted)' }}>
            {mode === 'login' ? '登录后进入场景' : '创建账号后进入场景'}
          </p>

          <div
            className="mt-6 flex gap-1 rounded-lg p-1"
            style={{ background: 'var(--ui-bg)' }}
            role="tablist"
            aria-label="登录或注册"
          >
            {(
              [
                ['login', '登录'],
                ['register', '注册'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                onClick={() => {
                  setMode(id);
                  setError(null);
                  setShowRecoverHint(false);
                }}
                className="flex-1 rounded-md px-3 py-2 text-sm font-medium"
                style={
                  mode === id
                    ? {
                        background: 'var(--ui-panel-solid)',
                        color: 'var(--ui-fg)',
                        boxShadow: 'var(--ui-shadow)',
                      }
                    : { color: 'var(--ui-fg-muted)' }
                }
              >
                {label}
              </button>
            ))}
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
                name="username"
                className="oc-input mt-1"
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
                name="password"
                className="oc-input mt-1"
                required
                minLength={6}
              />
            </label>

            {error && (
              <p className="oc-alert oc-alert-error" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="oc-btn oc-btn-primary w-full"
            >
              {submitting ? '请稍候…' : mode === 'login' ? '进入' : '注册并进入'}
            </button>
          </form>

          {mode === 'login' ? (
            <p className="mt-4 text-center text-sm">
              <button
                type="button"
                className="underline-offset-2 hover:underline"
                style={{ color: 'var(--ui-fg-muted)' }}
                onClick={() => setShowRecoverHint((v) => !v)}
                aria-expanded={showRecoverHint}
              >
                忘记密码？
              </button>
            </p>
          ) : null}

          {showRecoverHint ? (
            <p
              className="mt-2 text-center text-xs leading-relaxed"
              style={{ color: 'var(--ui-fg-muted)' }}
            >
              目前没有自助找回。请使用你记得的账号，或重新注册。
            </p>
          ) : null}
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
