/**
 * MA-W：根据措辞判断是否像「只对焦点说的悄悄话」。
 * 命中后复用现网 whisper 管线（跳过导演互聊/旁听、scene_log 标 whisper）。
 */
const WHISPER_PATTERNS: RegExp[] = [
  /悄悄(话|跟你|跟您|说)/,
  /小声(点|跟你|跟您|说|告诉)/,
  /别告诉(别人|其他人|旁人|她|他|她们|他们)/,
  /不要告诉(别人|其他人|旁人)/,
  /别跟(别人|其他人|旁人)说/,
  /只有你(能)?听/,
  /私下(里)?(跟你|跟您|说)/,
  /跟你说个秘密/,
  /这事(你)?先别(说|告诉|声张)/,
  /先别告诉别人/,
  /保密[，,。！!]?$/,
  /^保密[，,。\s]/,
];

export function detectWhisperIntent(message: string): boolean {
  const m = message.trim();
  if (!m) return false;
  return WHISPER_PATTERNS.some((re) => re.test(m));
}
