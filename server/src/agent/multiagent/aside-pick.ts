/**
 * MA-S：从候选里挑 aside 发言人；优先导演 speakers 中非焦点且在场者。
 */
export function pickAsideSpeaker(
  candidates: string[],
  focusNpcId: string,
  preferredSpeakerIds?: string[],
  rng: () => number = Math.random,
): string | null {
  if (candidates.length === 0) return null;
  const preferred = (preferredSpeakerIds ?? []).filter(
    (id) => id !== focusNpcId && candidates.includes(id),
  );
  const pool = preferred.length > 0 ? preferred : candidates;
  const idx = Math.floor(rng() * pool.length);
  return pool[Math.min(idx, pool.length - 1)] ?? null;
}
