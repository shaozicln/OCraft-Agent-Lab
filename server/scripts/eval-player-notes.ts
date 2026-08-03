/**
 * Mem-P 离线 Eval：抽取 / 合并 / 注入可见性 / whisper 不泄漏。
 *
 * 用法：npm run notes:eval
 */
import {
  buildPlayerNotesPromptBlock,
  extractPlayerNotes,
  mergePlayerNotes,
  selectNotesForInject,
} from '../src/agent/memory/player-notes';
import type { PlayerNote } from '@ocraft/shared';

type Case = {
  name: string;
  run: () => { ok: boolean; detail: string };
};

const cases: Case[] = [
  {
    name: '抽点：承诺句出要点',
    run: () => {
      const notes = extractPlayerNotes({
        message: '我承诺今晚一定把钥匙还给你',
        chapterId: 'ch1_daily',
        sourceNpcId: 'npc_a',
      });
      const ok =
        notes.length >= 1 &&
        notes.some(
          (n) =>
            n.keywords.includes('承诺') ||
            n.text.includes('承诺') ||
            n.keywords.some((k) => k.includes('钥匙')),
        );
      return { ok, detail: notes.map((n) => n.text).join(' | ') };
    },
  },
  {
    name: '抽点：寒暄不记',
    run: () => {
      const notes = extractPlayerNotes({
        message: '你好',
        chapterId: 'ch1_daily',
        sourceNpcId: 'npc_a',
      });
      return { ok: notes.length === 0, detail: `n=${notes.length}` };
    },
  },
  {
    name: '窗外仍可注入：旧笔记不依赖 5 句场记',
    run: () => {
      const old: PlayerNote = {
        id: 'note_old',
        text: '玩家说过：我叫沈檐',
        keywords: ['自称', '沈檐'],
        source_npc_id: 'npc_a',
        chapter_id: 'ch1_daily',
        visibility: 'public',
        at: '2026-01-01T00:00:00.000Z',
        conf: 0.9,
      };
      const selected = selectNotesForInject([old], {
        chatNpcId: 'npc_b',
        chapterId: 'ch2_unease',
      });
      const { ids, block } = buildPlayerNotesPromptBlock(selected);
      const ok = ids.includes('note_old') && block.includes('沈檐');
      return { ok, detail: ids.join(',') };
    },
  },
  {
    name: 'whisper 不泄漏给其他 NPC',
    run: () => {
      const whisperNotes = extractPlayerNotes({
        message: '别告诉别人，其实我发现了证据',
        chapterId: 'ch2_unease',
        sourceNpcId: 'npc_focus',
        whisper: true,
      });
      const okExtract =
        whisperNotes.length >= 1 &&
        whisperNotes.every((n) => n.visibility === 'whisper');
      const forOther = selectNotesForInject(whisperNotes, {
        chatNpcId: 'npc_other',
        chapterId: 'ch2_unease',
      });
      const forFocus = selectNotesForInject(whisperNotes, {
        chatNpcId: 'npc_focus',
        chapterId: 'ch2_unease',
      });
      const ok =
        okExtract && forOther.length === 0 && forFocus.length === whisperNotes.length;
      return {
        ok,
        detail: `extract=${whisperNotes.length} other=${forOther.length} focus=${forFocus.length}`,
      };
    },
  },
  {
    name: '合并去重 + cap',
    run: () => {
      const a = extractPlayerNotes({
        message: '我承诺会保密这件事',
        chapterId: 'ch1_daily',
        sourceNpcId: 'npc_a',
      });
      const b = extractPlayerNotes({
        message: '我承诺会保密这件事',
        chapterId: 'ch1_daily',
        sourceNpcId: 'npc_a',
      });
      const merged = mergePlayerNotes(a, b, 40);
      const ok = merged.length <= a.length + 1;
      return { ok, detail: `a=${a.length} merged=${merged.length}` };
    },
  },
];

let failed = 0;
for (const c of cases) {
  const { ok, detail } = c.run();
  if (ok) {
    console.log(`OK  ${c.name} :: ${detail}`);
  } else {
    failed += 1;
    console.log(`FAIL ${c.name} :: ${detail}`);
  }
}

console.log(
  failed === 0
    ? `\nOK notes:eval ${cases.length}/${cases.length}`
    : `\nFAIL notes:eval ${cases.length - failed}/${cases.length}`,
);
process.exit(failed === 0 ? 0 : 1);
