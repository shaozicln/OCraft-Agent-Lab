/**
 * AP-V offline：新建空包 / ensure / 加载空 instruction 均含【台词规矩·游戏内】。
 *
 * 用法：npm run voice:eval
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  DEFAULT_NPC_LINE_VOICE_RULES,
  DEFAULT_REPLY_INSTRUCTION,
  NPC_LINE_VOICE_RULES_MARKER,
  ensureNpcLineVoiceRules,
} from '@ocraft/shared';
import { createMinimalBlankPack } from '../src/story/pack-ops';
import {
  loadStoryPackFromDir,
  resolveStoryPacksRoot,
} from '../src/story/pack-loader';

type Case = { name: string; run: () => { ok: boolean; detail: string } };

const cases: Case[] = [
  {
    name: '常量含标记',
    run: () => {
      const ok =
        DEFAULT_NPC_LINE_VOICE_RULES.includes(NPC_LINE_VOICE_RULES_MARKER) &&
        DEFAULT_REPLY_INSTRUCTION.includes(NPC_LINE_VOICE_RULES_MARKER);
      return { ok, detail: `marker=${NPC_LINE_VOICE_RULES_MARKER}` };
    },
  },
  {
    name: 'ensure 空串 → 默认块',
    run: () => {
      const text = ensureNpcLineVoiceRules('');
      const ok = text.includes(NPC_LINE_VOICE_RULES_MARKER);
      return { ok, detail: `len=${text.length}` };
    },
  },
  {
    name: 'ensure 已有标记不重复',
    run: () => {
      const once = ensureNpcLineVoiceRules(DEFAULT_NPC_LINE_VOICE_RULES);
      const twice = ensureNpcLineVoiceRules(once);
      const count = (twice.match(new RegExp(NPC_LINE_VOICE_RULES_MARKER, 'g')) ?? [])
        .length;
      const ok = count === 1 && twice === once;
      return { ok, detail: `count=${count}` };
    },
  },
  {
    name: 'createMinimalBlankPack 含规矩',
    run: () => {
      const pack = createMinimalBlankPack({
        worldId: 'eval_voice',
        versionName: 'blank',
        versionDir: 'blank__eval',
      });
      const ok = pack.prompts.reply_instruction.includes(
        NPC_LINE_VOICE_RULES_MARKER,
      );
      return {
        ok,
        detail: `has=${ok} head=${pack.prompts.reply_instruction.slice(0, 24)}`,
      };
    },
  },
  {
    name: '加载 0713V2（曾空 instruction）含规矩',
    run: () => {
      const root = resolveStoryPacksRoot();
      const versionPath = path.join(
        root,
        'awaken',
        'versions',
        '0713V2__20260713T1009',
      );
      if (!fs.existsSync(versionPath)) {
        return { ok: false, detail: `missing ${versionPath}` };
      }
      const onDisk = JSON.parse(
        fs.readFileSync(path.join(versionPath, 'prompts.json'), 'utf8'),
      ) as { reply_instruction?: string };
      const pack = loadStoryPackFromDir(versionPath);
      const diskOk = (onDisk.reply_instruction ?? '').includes(
        NPC_LINE_VOICE_RULES_MARKER,
      );
      const loadedOk = pack.prompts.reply_instruction.includes(
        NPC_LINE_VOICE_RULES_MARKER,
      );
      return {
        ok: diskOk && loadedOk,
        detail: `disk=${diskOk} loaded=${loadedOk}`,
      };
    },
  },
];

let failed = 0;
for (const c of cases) {
  try {
    const r = c.run();
    console.log(`${r.ok ? '[PASS]' : '[FAIL]'} ${c.name} — ${r.detail}`);
    if (!r.ok) failed += 1;
  } catch (err) {
    failed += 1;
    console.log(
      `[FAIL] ${c.name} — ${err instanceof Error ? err.message : err}`,
    );
  }
}

console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed > 0 ? 1 : 0);
