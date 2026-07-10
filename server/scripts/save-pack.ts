/**
 * 另存为新包版本（拷贝目录 + 改 pack.json 头）。
 * 若设置了 DATABASE_URL，会顺带 seed 进库。
 *
 * 用法：
 *   npm run pack:save -- --name 我的改版
 *   npm run pack:save -- --world office --from official-mvp__20260710T1045 --name 测试版
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { loadOfficialPack, resolveStoryPacksRoot } from '../src/story/pack-loader';
import { savePackAsCopy } from '../src/story/pack-ops';
import { storyPackVersions } from '../src/db/schema';

config({ path: resolve(__dirname, '../.env') });

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--name' || a === '-n') out.name = argv[++i] ?? '';
    else if (a === '--world' || a === '-w') out.world = argv[++i] ?? '';
    else if (a === '--from' || a === '-f') out.from = argv[++i] ?? '';
    else if (a === '--notes') out.notes = argv[++i] ?? '';
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.name?.trim()) {
    console.error(
      '用法: npm run pack:save -- --name <版本名> [--world office] [--from <versionDir>]',
    );
    process.exit(1);
  }

  const official = loadOfficialPack(resolveStoryPacksRoot());
  const worldId = args.world || official.header.world_id;
  const fromVersionDir = args.from || official.version_dir;

  const result = savePackAsCopy({
    worldId,
    fromVersionDir,
    versionName: args.name,
    notes: args.notes,
  });

  console.log('OK saved to disk');
  console.log(
    JSON.stringify(
      {
        world_id: result.worldId,
        version_dir: result.versionDir,
        version_name: result.pack.header.display_name,
        path: result.versionPath,
      },
      null,
      2,
    ),
  );

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log('(skip seed: DATABASE_URL not set)');
    return;
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);
  try {
    await db
      .insert(storyPackVersions)
      .values({
        worldId: result.worldId,
        packVersionId: result.versionDir,
        displayName: result.pack.header.display_name,
        createdAt: result.pack.header.created_at,
        notes: result.pack.header.notes,
        packJson: result.pack,
        seededAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [storyPackVersions.worldId, storyPackVersions.packVersionId],
        set: {
          displayName: result.pack.header.display_name,
          createdAt: result.pack.header.created_at,
          notes: result.pack.header.notes,
          packJson: result.pack,
          seededAt: new Date(),
        },
      });
    console.log('OK seeded to DB');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('FAIL', err instanceof Error ? err.message : err);
  process.exit(1);
});
