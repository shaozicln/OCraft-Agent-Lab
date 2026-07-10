'use client';

import { useEffect, useState } from 'react';
import type { NpcPublicResponse } from '@ocraft/shared';
import { GAME_SERVER_URL } from '@/config/game';

export function useNpcConfig(npcId: string, token: string) {
  const [npc, setNpc] = useState<NpcPublicResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!npcId || !token) {
      setLoading(false);
      setNpc(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${GAME_SERVER_URL}/npc/${encodeURIComponent(npcId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to load NPC (${res.status})`);
        }
        return res.json() as Promise<NpcPublicResponse>;
      })
      .then((data) => {
        if (!cancelled) {
          setNpc(data);
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
  }, [npcId, token]);

  return { npc, loading, error };
}
