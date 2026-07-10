import * as fs from 'fs';
import * as path from 'path';
import type { StoryPack } from '@ocraft/shared';
import {
  loadStoryPackFromDir,
  loadWorldManifest,
  resolveStoryPacksRoot,
} from './pack-loader';

/** 目录名安全化：保留中文/字母数字，其余变 _ */
export function sanitizeVersionNameForDir(versionName: string): string {
  const trimmed = versionName.trim();
  const safe = trimmed
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return safe.slice(0, 48) || 'pack';
}

/** @deprecated 使用 sanitizeVersionNameForDir */
export const sanitizeDisplayNameForDir = sanitizeVersionNameForDir;

/** yyyyMMddTHHmm（本地时间） */
export function formatPackTimestamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `T${pad(date.getHours())}${pad(date.getMinutes())}`
  );
}

export function makeVersionDirName(
  versionName: string,
  date = new Date(),
): string {
  return `${sanitizeVersionNameForDir(versionName)}__${formatPackTimestamp(date)}`;
}

export function resolveVersionPath(
  worldId: string,
  versionDir: string,
  packsRoot = resolveStoryPacksRoot(),
): string {
  return path.join(packsRoot, worldId, 'versions', versionDir);
}

function writeJson(filePath: string, data: unknown) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

/**
 * 将完整 Pack 写回版本目录（覆盖 pack/world/triggers/prompts/npcs）。
 * 调用方须先用 storyPackSchema + assertPackReferences 校验。
 */
export function writeStoryPackToDir(
  versionDirPath: string,
  pack: StoryPack,
): void {
  fs.mkdirSync(versionDirPath, { recursive: true });
  const npcsDir = path.join(versionDirPath, 'npcs');
  fs.mkdirSync(npcsDir, { recursive: true });

  writeJson(path.join(versionDirPath, 'pack.json'), pack.header);
  writeJson(path.join(versionDirPath, 'world.json'), pack.world);
  writeJson(path.join(versionDirPath, 'triggers.json'), pack.triggers);
  writeJson(path.join(versionDirPath, 'prompts.json'), pack.prompts);

  // 清掉旧 npc 文件再写入，避免残留
  for (const f of fs.readdirSync(npcsDir)) {
    if (f.endsWith('.json')) {
      fs.unlinkSync(path.join(npcsDir, f));
    }
  }
  for (const npc of pack.npcs) {
    writeJson(path.join(npcsDir, `${npc.npc_id}.json`), npc);
  }
}

function copyDirRecursive(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(from, to);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
    }
  }
}

export interface SavePackAsResult {
  worldId: string;
  versionDir: string;
  versionPath: string;
  pack: StoryPack;
}

/**
 * 另存/新建后清空文案：结构与 id 保留，展示/正文全空；默认包仅作表单 placeholder。
 */
export function blankifyStoryPack(
  pack: StoryPack,
  opts: { versionName: string; worldId: string },
): StoryPack {
  const chapterConstraints: Record<string, string> = {};
  for (const ch of pack.world.chapters) {
    chapterConstraints[ch.id] = '';
  }

  return {
    ...pack,
    header: {
      ...pack.header,
      world_id: opts.worldId,
      display_name: opts.versionName.trim(),
      created_at: formatPackTimestamp(),
      notes: undefined,
    },
    world: {
      ...pack.world,
      chapters: pack.world.chapters.map((c) => ({
        ...c,
        display_name: '',
        hud_label: undefined,
      })),
      flags: pack.world.flags.map((f) => ({
        ...f,
        description: undefined,
      })),
      numeric_tools: {
        fatigue_increase: {
          triggers: [],
          delta: pack.world.numeric_tools.fatigue_increase.delta,
          reason: '',
        },
        interest_hit: {
          affinity_delta: pack.world.numeric_tools.interest_hit.affinity_delta,
          affinity_reason: '',
          fatigue_delta: pack.world.numeric_tools.interest_hit.fatigue_delta,
          fatigue_reason: '',
        },
      },
      animation_rules: pack.world.animation_rules.map((r) => ({
        ...r,
        when: {
          ...r.when,
          message_triggers: undefined,
        },
      })),
      endings: (pack.world.endings ?? []).map((e) => ({
        ...e,
        display_name: '',
        notes: undefined,
        performance_hint: undefined,
      })),
    },
    triggers: {
      version: pack.triggers.version ?? 1,
      rules: pack.triggers.rules.map((r) => ({
        ...r,
        player_triggers: [],
        notes: undefined,
      })),
      npc_reply_flag_rules: (pack.triggers.npc_reply_flag_rules ?? []).map(
        (r) => ({
          ...r,
          triggers: [],
        }),
      ),
    },
    prompts: {
      affinity_tiers: pack.prompts.affinity_tiers.map((t) => ({
        ...t,
        text: '',
      })),
      fatigue_hints: pack.prompts.fatigue_hints.map((h) => ({
        ...h,
        text: '',
      })),
      chapter_constraints: chapterConstraints,
      flag_constraints: pack.prompts.flag_constraints.map((f) => ({
        ...f,
        text: '',
      })),
      reply_instruction: '',
    },
    npcs: pack.npcs.map((n) => ({
      ...n,
      name: '',
      meta: {
        ...n.meta,
        avatar: '',
        model_path: '',
      },
      attributes: {
        ...n.attributes,
        favorite_things: [],
        favorite_synonyms: undefined,
      },
      system_prompt_template: '',
      memories: n.memories.map((m) => ({
        ...m,
        tags: [],
        keywords: [],
        content: '',
      })),
    })),
  };
}

/**
 * 另存为新版本：拷贝源目录 → 新 `{版本名}__{时间戳}`，并改 pack.json 头信息。
 */
export function savePackAsCopy(opts: {
  worldId: string;
  fromVersionDir: string;
  versionName: string;
  notes?: string;
  packsRoot?: string;
  /** 跨世界复制时指定源世界；默认与目标同世界 */
  fromWorldId?: string;
  /** 清空文案，仅保留结构（新建/空白模板） */
  blankContent?: boolean;
}): SavePackAsResult {
  const packsRoot = opts.packsRoot ?? resolveStoryPacksRoot();
  const fromWorldId = opts.fromWorldId ?? opts.worldId;
  const srcPath = resolveVersionPath(
    fromWorldId,
    opts.fromVersionDir,
    packsRoot,
  );
  if (!fs.existsSync(srcPath)) {
    throw new Error(`源包不存在: ${srcPath}`);
  }

  const sourcePack = loadStoryPackFromDir(srcPath);

  const versionDir = makeVersionDirName(opts.versionName);
  const destPath = resolveVersionPath(opts.worldId, versionDir, packsRoot);
  if (fs.existsSync(destPath)) {
    throw new Error(`目标版本目录已存在: ${versionDir}`);
  }

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  copyDirRecursive(srcPath, destPath);

  let pack: StoryPack;
  if (opts.blankContent) {
    pack = blankifyStoryPack(sourcePack, {
      versionName: opts.versionName,
      worldId: opts.worldId,
    });
    pack = { ...pack, version_dir: versionDir };
    writeStoryPackToDir(destPath, pack);
    pack = loadStoryPackFromDir(destPath);
  } else {
    const packJsonPath = path.join(destPath, 'pack.json');
    const header = JSON.parse(fs.readFileSync(packJsonPath, 'utf-8')) as Record<
      string,
      unknown
    >;
    header.world_id = opts.worldId;
    header.display_name = opts.versionName.trim();
    header.created_at = formatPackTimestamp();
    if (opts.notes !== undefined) {
      header.notes = opts.notes;
    } else {
      header.notes = `另存自 ${fromWorldId}/${opts.fromVersionDir}`;
    }
    fs.writeFileSync(
      packJsonPath,
      `${JSON.stringify(header, null, 2)}\n`,
      'utf-8',
    );
    pack = loadStoryPackFromDir(destPath);
  }

  return {
    worldId: opts.worldId,
    versionDir,
    versionPath: destPath,
    pack,
  };
}

/**
 * 新建世界：写 manifest（无显示名）+ 从源包复制首个版本。
 */
export function createWorldPack(opts: {
  worldId: string;
  versionName: string;
  description?: string;
  notes?: string;
  fromWorldId: string;
  fromVersionDir: string;
  packsRoot?: string;
}): SavePackAsResult {
  const packsRoot = opts.packsRoot ?? resolveStoryPacksRoot();
  const worldPath = path.join(packsRoot, opts.worldId);
  if (fs.existsSync(worldPath)) {
    throw new Error(`世界已存在: ${opts.worldId}`);
  }

  fs.mkdirSync(path.join(worldPath, 'versions'), { recursive: true });

  const result = savePackAsCopy({
    worldId: opts.worldId,
    fromWorldId: opts.fromWorldId,
    fromVersionDir: opts.fromVersionDir,
    versionName: opts.versionName,
    notes: opts.notes ?? `新建自 ${opts.fromWorldId}/${opts.fromVersionDir}`,
    packsRoot,
    blankContent: true,
  });

  writeJson(path.join(worldPath, 'manifest.json'), {
    world_id: opts.worldId,
    official_version_dir: result.versionDir,
    description: opts.description?.trim() || undefined,
  });

  return result;
}

export function listDiskWorldSummaries(packsRoot = resolveStoryPacksRoot()) {
  if (!fs.existsSync(packsRoot)) return [];

  const officialWorld = process.env.OFFICIAL_WORLD ?? 'office';
  const worlds: Array<{
    world_id: string;
    description?: string;
    official_version_dir: string;
    versions: Array<{
      world_id: string;
      version_dir: string;
      version_name: string;
      created_at: string;
      notes?: string;
      is_official: boolean;
    }>;
  }> = [];

  for (const entry of fs.readdirSync(packsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const worldId = entry.name;
    let manifest;
    try {
      manifest = loadWorldManifest(packsRoot, worldId);
    } catch {
      continue;
    }

    const officialVersionDir =
      worldId === officialWorld
        ? (process.env.OFFICIAL_VERSION_DIR ?? manifest.official_version_dir)
        : manifest.official_version_dir;

    const versionsPath = path.join(packsRoot, worldId, 'versions');
    const versions: (typeof worlds)[number]['versions'] = [];
    if (fs.existsSync(versionsPath)) {
      for (const v of fs.readdirSync(versionsPath, { withFileTypes: true })) {
        if (!v.isDirectory()) continue;
        try {
          const pack = loadStoryPackFromDir(path.join(versionsPath, v.name));
          versions.push({
            world_id: worldId,
            version_dir: pack.version_dir,
            version_name: pack.header.display_name,
            created_at: pack.header.created_at,
            notes: pack.header.notes,
            is_official:
              worldId === officialWorld &&
              pack.version_dir === officialVersionDir,
          });
        } catch {
          // 坏包跳过
        }
      }
    }

    versions.sort((a, b) => b.created_at.localeCompare(a.created_at));
    worlds.push({
      world_id: worldId,
      description: manifest.description,
      official_version_dir: officialVersionDir,
      versions,
    });
  }

  return worlds.sort((a, b) => a.world_id.localeCompare(b.world_id));
}

function rmDirRecursive(dirPath: string) {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

/** 删除某版本目录；若删的是测试指针则需调用方先改 manifest */
export function deleteVersionOnDisk(
  worldId: string,
  versionDir: string,
  packsRoot = resolveStoryPacksRoot(),
): void {
  const versionPath = resolveVersionPath(worldId, versionDir, packsRoot);
  if (!fs.existsSync(versionPath)) {
    throw new Error(`版本不存在: ${worldId}/${versionDir}`);
  }
  rmDirRecursive(versionPath);
}

/** 删除整个世界目录（含所有版本） */
export function deleteWorldOnDisk(
  worldId: string,
  packsRoot = resolveStoryPacksRoot(),
): void {
  const worldPath = path.join(packsRoot, worldId);
  if (!fs.existsSync(worldPath)) {
    throw new Error(`世界不存在: ${worldId}`);
  }
  rmDirRecursive(worldPath);
}

export function writeWorldManifest(
  worldId: string,
  manifest: {
    world_id: string;
    official_version_dir: string;
    description?: string;
  },
  packsRoot = resolveStoryPacksRoot(),
): void {
  writeJson(path.join(packsRoot, worldId, 'manifest.json'), {
    world_id: manifest.world_id,
    official_version_dir: manifest.official_version_dir,
    description: manifest.description,
  });
}
