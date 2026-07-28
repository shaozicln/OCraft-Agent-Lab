/** 本地确定性词袋向量（无 API 时的 Mem-V 向量路径；非神经网络） */
export const LOCAL_EMBED_DIM = 128;

export function l2Normalize(vec: number[]): number[] {
  let sum = 0;
  for (const x of vec) sum += x * x;
  const norm = Math.sqrt(sum);
  if (norm < 1e-12) return vec.map(() => 0);
  return vec.map((x) => x / norm);
}

/** 字符 + bigram 哈希袋 → 固定维 L2 向量 */
export function localEmbed(text: string): number[] {
  const v = new Array<number>(LOCAL_EMBED_DIM).fill(0);
  const s = text.toLowerCase().trim();
  if (!s) return v;

  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    v[c % LOCAL_EMBED_DIM] += 1;
    if (i + 1 < s.length) {
      const b = (c * 31 + s.charCodeAt(i + 1)) % LOCAL_EMBED_DIM;
      v[b] += 1.5;
    }
  }

  // 粗分词：连续汉字/字母数字块再加权
  const tokens = s.match(/[\u4e00-\u9fff]+|[a-z0-9]+/gi) ?? [];
  for (const tok of tokens) {
    let h = 0;
    for (let i = 0; i < tok.length; i++) {
      h = (h * 33 + tok.charCodeAt(i)) >>> 0;
    }
    v[h % LOCAL_EMBED_DIM] += 2;
  }

  return l2Normalize(v);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < n; i++) dot += a[i]! * b[i]!;
  return dot;
}

/** 拼记忆文本供 embedding（content + keywords/tags） */
export function memoryEmbedText(memory: {
  content: string;
  keywords?: string[];
  tags?: string[];
}): string {
  const parts = [memory.content];
  if (memory.keywords?.length) parts.push(memory.keywords.join(' '));
  if (memory.tags?.length) parts.push(memory.tags.join(' '));
  return parts.join('\n');
}
