'use client';

import { GAME_SERVER_URL } from '@/config/game';

export async function apiFetch<T>(
  path: string,
  opts: {
    token?: string;
    method?: string;
    body?: unknown;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (opts.token) {
    headers.Authorization = `Bearer ${opts.token}`;
  }
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${GAME_SERVER_URL}${path}`, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }

  if (!res.ok) {
    const msg =
      typeof data === 'object' &&
      data &&
      'message' in data &&
      typeof (data as { message: unknown }).message === 'string'
        ? (data as { message: string }).message
        : `请求失败 (${res.status})`;
    throw new Error(Array.isArray(msg) ? msg.join('；') : msg);
  }

  return data as T;
}

/** 读取 POST SSE（data: JSON\\n\\n），每条事件回调一次 */
export async function apiFetchSse(
  path: string,
  opts: {
    token?: string;
    body?: unknown;
    signal?: AbortSignal;
    onEvent: (data: unknown) => void;
  },
): Promise<void> {
  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
  };
  if (opts.token) {
    headers.Authorization = `Bearer ${opts.token}`;
  }

  const res = await fetch(`${GAME_SERVER_URL}${path}`, {
    method: 'POST',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = `请求失败 (${res.status})`;
    try {
      const data = JSON.parse(text) as { message?: string | string[] };
      if (typeof data.message === 'string') msg = data.message;
      else if (Array.isArray(data.message)) msg = data.message.join('；');
    } catch {
      if (text) msg = text.slice(0, 300);
    }
    throw new Error(msg);
  }

  if (!res.body) {
    throw new Error('浏览器不支持流式响应');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const lines = part.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          opts.onEvent(JSON.parse(payload));
        } catch {
          // ignore malformed chunk
        }
      }
    }
  }
}
