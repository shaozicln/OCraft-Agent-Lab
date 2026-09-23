import * as path from 'path';

/**
 * 剧情包路径安全收口。
 *
 * 背景：`PUT /packs/worlds/:worldId/versions/:versionDir` 的 versionDir 直接来自
 * URL 参数，历史上未做任何校验就被拼进 path.join()，配合 `%2E%2E%2F` 可以跳出
 * story-packs 根目录，在任意已存在目录写 pack.json / world.json 等文件。
 *
 * 这里提供两道防线：
 * 1. 段级校验：拒绝路径分隔符、`..`、控制字符、超长段；
 * 2. 收敛校验：path.resolve 之后断言结果仍在根目录之内。
 * 第 2 条是真正的保证，第 1 条用于给出清晰错误并拦住明显恶意输入。
 *
 * 注意：本项目允许版本目录名含中文（见 sanitizeVersionNameForDir），
 * 所以这里用「黑名单 + 根内断言」而不是严格字符白名单，避免误伤既有目录。
 */

/** 路径分隔符、空字节、控制字符、以及任何位置的 `..` */
const FORBIDDEN_SEGMENT = /[\\/\0\x00-\x1f]|\.\./;
const MAX_SEGMENT_LENGTH = 64;

export function assertSafePathSegment(value: string, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} 非法：不能为空`);
  }
  if (value.length > MAX_SEGMENT_LENGTH) {
    throw new Error(`${label} 非法：长度超过 ${MAX_SEGMENT_LENGTH}`);
  }
  if (FORBIDDEN_SEGMENT.test(value)) {
    throw new Error(
      `${label} 非法：不允许路径分隔符、控制字符或 ..（收到 ${JSON.stringify(value)}）`,
    );
  }
  if (value === '.') {
    throw new Error(`${label} 非法：不允许 "."`);
  }
  return value;
}

/** 断言 candidate 解析后仍落在 root 之内，并返回解析后的绝对路径 */
export function assertInsideRoot(
  root: string,
  candidate: string,
  label: string,
): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(candidate);
  if (
    resolved !== resolvedRoot &&
    !resolved.startsWith(resolvedRoot + path.sep)
  ) {
    throw new Error(`${label} 越出剧情包根目录：${candidate}`);
  }
  return resolved;
}

/** 剧情包根目录下的世界目录 */
export function resolveWorldPath(packsRoot: string, worldId: string): string {
  assertSafePathSegment(worldId, 'worldId');
  const root = path.resolve(packsRoot);
  return assertInsideRoot(root, path.join(root, worldId), 'worldId');
}

/** 世界目录下的 versions 目录 */
export function resolveVersionsPath(
  packsRoot: string,
  worldId: string,
): string {
  return path.join(resolveWorldPath(packsRoot, worldId), 'versions');
}

/** 世界目录下的某个版本目录 */
export function resolveVersionDirPath(
  packsRoot: string,
  worldId: string,
  versionDir: string,
): string {
  assertSafePathSegment(versionDir, 'versionDir');
  const root = path.resolve(packsRoot);
  return assertInsideRoot(
    root,
    path.join(resolveVersionsPath(root, worldId), versionDir),
    'versionDir',
  );
}
