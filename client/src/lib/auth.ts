import type { AuthSession } from '@ocraft/shared';
import {
  authSessionSchema,
  formatAuthValidationError,
  loginPayloadSchema,
  registerPayloadSchema,
} from '@ocraft/shared';
import { GAME_SERVER_URL } from '@/config/game';

const STORAGE_KEY = 'ocraft_auth_session';

function parseApiError(data: { message?: unknown }, fallback: string): string {
  const raw = data.message;
  if (Array.isArray(raw)) {
    return raw.map(String).join('；');
  }
  if (typeof raw === 'string') {
    if (raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw) as Array<{ message?: string }>;
        const msg = parsed
          .map((item) => item.message)
          .filter(Boolean)
          .join('；');
        if (msg) return msg;
      } catch {
        // ignore malformed JSON error payloads
      }
    }
    return raw;
  }
  return fallback;
}

export function getAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = authSessionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function setAuthSession(session: AuthSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export async function registerAccount(
  username: string,
  password: string,
): Promise<AuthSession> {
  const res = await fetch(`${GAME_SERVER_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseApiError(data, '注册失败'));
  }

  const session = authSessionSchema.parse(data);
  setAuthSession(session);
  return session;
}

export async function loginAccount(
  username: string,
  password: string,
): Promise<AuthSession> {
  const res = await fetch(`${GAME_SERVER_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseApiError(data, '登录失败'));
  }

  const session = authSessionSchema.parse(data);
  setAuthSession(session);
  return session;
}

export async function validateAuthSession(
  session: AuthSession,
): Promise<AuthSession | null> {
  const res = await fetch(`${GAME_SERVER_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });

  if (!res.ok) return null;

  const data = await res.json().catch(() => null);
  if (!data) return null;

  const next = authSessionSchema.parse(data);
  setAuthSession(next);
  return next;
}
