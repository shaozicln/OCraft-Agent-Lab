'use client';

import { useEffect, useState } from 'react';
import type { PackRuntime } from '@ocraft/shared';
import { GAME_SERVER_URL } from '@/config/game';

/** 拉取当前玩家生效包（无选用则默认默认） */
export function usePackRuntime(token: string) {
  const [runtime, setRuntime] = useState<PackRuntime | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${GAME_SERVER_URL}/packs/runtime`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to load pack runtime (${res.status})`);
        }
        return res.json() as Promise<PackRuntime>;
      })
      .then((data) => {
        if (!cancelled) {
          setRuntime(data);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return { runtime, loading, error };
}
