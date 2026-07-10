import * as fs from 'fs';
import * as path from 'path';
import {
  assertPackReferences,
  packHeaderSchema,
  packNpcSchema,
  packPromptsFileSchema,
  packTriggersFileSchema,
  packWorldFileSchema,
  storyPackSchema,
  worldManifestSchema,
  type StoryPack,
  type WorldManifest,
} from '@ocraft/shared';

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * 仓库根目录下的 story-packs。
 * 兼容 dist/src/story 与 src/story 两种运行布局；也可用 STORY_PACKS_ROOT 覆盖。
 */
export function resolveStoryPacksRoot(): string {
  const fromEnv = process.env.STORY_PACKS_ROOT;
  if (fromEnv) return path.resolve(fromEnv);

  const candidates = [
    path.resolve(__dirname, '..', '..', '..', '..', 'story-packs'), // dist/src/story
    path.resolve(__dirname, '..', '..', '..', 'story-packs'), // src/story
    path.resolve(process.cwd(), '..', 'story-packs'), // cwd = server/
    path.resolve(process.cwd(), 'story-packs'), // cwd = repo root
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

export function loadWorldManifest(
  packsRoot: string,
  worldId: string,
): WorldManifest {
  const manifestPath = path.join(packsRoot, worldId, 'manifest.json');
  return worldManifestSchema.parse(readJson(manifestPath));
}

export function loadStoryPackFromDir(versionDirPath: string): StoryPack {
  const version_dir = path.basename(versionDirPath);
  const header = packHeaderSchema.parse(
    readJson(path.join(versionDirPath, 'pack.json')),
  );
  const world = packWorldFileSchema.parse(
    readJson(path.join(versionDirPath, 'world.json')),
  );
  const triggers = packTriggersFileSchema.parse(
    readJson(path.join(versionDirPath, 'triggers.json')),
  );
  const prompts = packPromptsFileSchema.parse(
    readJson(path.join(versionDirPath, 'prompts.json')),
  );

  const npcsDir = path.join(versionDirPath, 'npcs');
  const npcFiles = fs
    .readdirSync(npcsDir)
    .filter((f) => f.endsWith('.json'))
    .sort();
  const npcs = npcFiles.map((f) =>
    packNpcSchema.parse(readJson(path.join(npcsDir, f))),
  );

  const pack = storyPackSchema.parse({
    header,
    world,
    triggers,
    prompts,
    npcs,
    version_dir,
  });
  assertPackReferences(pack);
  return pack;
}

export function loadOfficialPack(
  packsRoot = resolveStoryPacksRoot(),
  worldId = process.env.OFFICIAL_WORLD ?? 'office',
): StoryPack {
  const manifest = loadWorldManifest(packsRoot, worldId);
  const versionDir =
    process.env.OFFICIAL_VERSION_DIR ?? manifest.official_version_dir;
  const versionPath = path.join(
    packsRoot,
    worldId,
    'versions',
    versionDir,
  );
  if (!fs.existsSync(versionPath)) {
    throw new Error(`Official pack not found: ${versionPath}`);
  }
  return loadStoryPackFromDir(versionPath);
}

export function listWorldIds(packsRoot = resolveStoryPacksRoot()): string[] {
  if (!fs.existsSync(packsRoot)) return [];
  return fs
    .readdirSync(packsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

export function listVersionDirs(
  packsRoot: string,
  worldId: string,
): string[] {
  const versionsPath = path.join(packsRoot, worldId, 'versions');
  if (!fs.existsSync(versionsPath)) return [];
  return fs
    .readdirSync(versionsPath, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}
