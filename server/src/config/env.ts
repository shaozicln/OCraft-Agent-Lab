/**
 * 环境变量集中读取与校验。
 *
 * 安全默认值原则：
 * 1. 服务默认只监听本机回环地址（BIND_HOST 缺省 127.0.0.1）。局域网、
 *    公共 WiFi、Radmin VPN 之类的虚拟局域网上的其他设备都无法直连。
 * 2. AUTH_SECRET 必填，且不接受占位符 —— 缺失时拒绝启动，避免出现
 *    「以为配了、其实正在用公开可知的兜底密钥」这种最坏情况。
 * 3. 只有显式把 BIND_HOST 指到外部地址时，才要求配置 PACK_ADMIN_IDS。
 *    本机单人使用时不必配置，减少折腾。
 */

/** 已知的占位符 / 示例密钥，一律视为「未配置」 */
const PLACEHOLDER_SECRETS = new Set([
  'change-me-in-production',
  'dev-auth-secret-change-me',
  'changeme',
  'change_me',
  'secret',
  'test',
]);

/** 密钥最短长度：过短可被离线暴力枚举 */
const MIN_SECRET_LENGTH = 16;

const LOOPBACK_HOSTS = new Set([
  '127.0.0.1',
  'localhost',
  '::1',
  '::ffff:127.0.0.1',
]);

export const AUTH_SECRET_GENERATE_HINT =
  'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"';

/** 读取校验过的 AUTH_SECRET；不合格返回 null */
export function readAuthSecret(): string | null {
  const raw = (process.env.AUTH_SECRET ?? '').trim();
  if (!raw) return null;
  if (PLACEHOLDER_SECRETS.has(raw.toLowerCase())) return null;
  if (raw.length < MIN_SECRET_LENGTH) return null;
  return raw;
}

export function requireAuthSecret(): string {
  const secret = readAuthSecret();
  if (secret) return secret;
  throw new Error(
    [
      'AUTH_SECRET 未配置或不合格，服务拒绝启动。',
      `要求：至少 ${MIN_SECRET_LENGTH} 位随机字符串，且不能是 change-me-in-production 之类的占位符。`,
      '请在 server/.env 中设置，例如：',
      `  AUTH_SECRET=<随机串>   （生成：${AUTH_SECRET_GENERATE_HINT}）`,
    ].join('\n'),
  );
}

/** 监听地址；缺省只监听本机回环 */
export function bindHost(): string {
  return (process.env.BIND_HOST ?? '').trim() || '127.0.0.1';
}

/** 是否只监听本机（此时无需额外的写操作白名单） */
export function isLoopbackOnly(): boolean {
  return LOOPBACK_HOSTS.has(bindHost().toLowerCase());
}

/** 允许的前端来源；支持逗号分隔多值 */
export function clientOrigins(): string[] {
  const list = (process.env.CLIENT_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : ['http://localhost:3300'];
}

/**
 * 允许「改写/删除剧情包」与「触发 AI 生成」的玩家白名单（playerId，逗号分隔）。
 * 只在服务对网络开放时才被要求配置。
 */
export function packAdminIds(): string[] {
  return (process.env.PACK_ADMIN_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 启动自检。AUTH_SECRET 不合格会直接抛错终止启动；
 * 返回的字符串数组是需要打印的告警（不阻断启动）。
 */
export function assertServerEnv(): string[] {
  requireAuthSecret();

  const warnings: string[] = [];
  if (!isLoopbackOnly() && packAdminIds().length === 0) {
    warnings.push(
      `BIND_HOST=${bindHost()} 表示服务已对网络开放，但未配置 PACK_ADMIN_IDS：` +
        '剧情包写入 / 删除 / AI 生成类接口将被拒绝（对话与只读功能不受影响）。',
    );
  }
  return warnings;
}
