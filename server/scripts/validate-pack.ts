/**
 * 校验 story-packs 下默认包（或指定目录）能否通过 Schema + 交叉引用。
 * 用法：npx ts-node -r tsconfig-paths/register scripts/validate-pack.ts
 *       npx ts-node -r tsconfig-paths/register scripts/validate-pack.ts ../story-packs/office/versions/official-mvp__20260710T1045
 */
import * as path from 'path';
import {
  loadOfficialPack,
  loadStoryPackFromDir,
  resolveStoryPacksRoot,
} from '../src/story/pack-loader';

const arg = process.argv[2];
try {
  const pack = arg
    ? loadStoryPackFromDir(path.resolve(arg))
    : loadOfficialPack(resolveStoryPacksRoot());
  console.log('OK pack validated');
  console.log(
    JSON.stringify(
      {
        world_id: pack.header.world_id,
        display_name: pack.header.display_name,
        version_dir: pack.version_dir,
        chapters: pack.world.chapters.map((c) => c.id),
        flags: pack.world.flags.map((f) => f.name),
        npcs: pack.npcs.map((n) => n.npc_id),
        trigger_rules: pack.triggers.rules.length,
        flag_constraints: pack.prompts.flag_constraints.length,
      },
      null,
      2,
    ),
  );
} catch (err) {
  console.error('FAIL', err instanceof Error ? err.message : err);
  process.exit(1);
}
