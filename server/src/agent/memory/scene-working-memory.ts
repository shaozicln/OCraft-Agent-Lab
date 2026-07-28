import type { SceneUtterance } from '@ocraft/shared';

/** 与导演 / harness 共用的公开场近期句数 */
export const PUBLIC_SCENE_LINE_LIMIT = 5;

/** 单条 scene_log → 可读一行（导演 / Mem-W 共用） */
export function formatSceneUtteranceLine(u: SceneUtterance): string {
  if (u.kind === 'player_to_npc') return `玩家：${u.text}`;
  if (u.kind === 'npc_to_player') {
    return `${u.speaker_name}：${u.text}`;
  }
  if (u.kind === 'npc_to_npc') {
    const target = u.addressee_name ?? '?';
    return `${u.speaker_name}→${target}：${u.text}`;
  }
  return `${u.speaker_name}：${u.text}`;
}

export function formatSceneUtteranceLines(
  utterances: SceneUtterance[],
): string[] {
  return utterances.map(formatSceneUtteranceLine);
}

/**
 * Mem-W：把公开场近期句拼进 system（不含 quietly 话；调用方应先 getPublicSceneLog）。
 */
export function buildPublicSceneWorkingMemoryBlock(
  publicUtterances: SceneUtterance[],
  limit = PUBLIC_SCENE_LINE_LIMIT,
): { lines: string[]; block: string } {
  const lines = formatSceneUtteranceLines(publicUtterances.slice(-limit));
  const body =
    lines.length > 0
      ? lines.join('\n')
      : '（尚无公开对白）';
  const block = [
    '【公开场近期对白】',
    '（场上旁人可见；不含悄悄话。可自然回应场上刚发生的事，勿复述本标签。）',
    body,
  ].join('\n');
  return { lines, block };
}
