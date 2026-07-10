/**
 * 将磁盘上的包版本 seed 进 PostgreSQL（story_pack_versions）。
 *
 * 用法：
 *   npm run pack:seed
 *   npm run pack:seed -- office official-mvp__20260710T1045
 *   npm run pack:seed -- ../story-packs/office/versions/official-mvp__20260710T1045
 */
import { config } from 'dotenv';
import { resolve, basename, dirname } from 'path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  loadOfficialPack,
  loadStoryPackFromDir,
  resolveStoryPacksRoot,
} from '../src/story/pack-loader';
import { storyPackVersions } from '../src/db/schema';

config({ path: resolve(__dirname, '../.env') });

async function main() {
  const arg1 = process.argv[2];
  const arg2 = process.argv[3];

  let pack;
  let worldId: string;
  let versionDir: string;

  if (!arg1) {
    pack = loadOfficialPack(resolveStoryPacksRoot());
    worldId = pack.header.world_id;
    versionDir = pack.version_dir;
  } else if (arg2) {
    worldId = arg1;
    versionDir = arg2;
    pack = loadStoryPackFromDir(
      resolve(resolveStoryPacksRoot(), worldId, 'versions', versionDir),
    );
  } else {
    const versionPath = resolve(arg1);
    pack = loadStoryPackFromDir(versionPath);
    versionDir = basename(versionPath);
    worldId = basename(dirname(dirname(versionPath)));
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('FAIL DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  try {
    await db
      .insert(storyPackVersions)
      .values({
        worldId,
        packVersionId: pack.version_dir,
        displayName: pack.header.display_name,
        createdAt: pack.header.created_at,
        notes: pack.header.notes,
        packJson: pack,
        seededAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [storyPackVersions.worldId, storyPackVersions.packVersionId],
        set: {
          displayName: pack.header.display_name,
          createdAt: pack.header.created_at,
          notes: pack.header.notes,
          packJson: pack,
          seededAt: new Date(),
        },
      });

    console.log('OK seeded');
    console.log(
      JSON.stringify(
        {
          world_id: worldId,
          version_dir: pack.version_dir,
          display_name: pack.header.display_name,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('FAIL', err instanceof Error ? err.message : err);
  process.exit(1);
});
