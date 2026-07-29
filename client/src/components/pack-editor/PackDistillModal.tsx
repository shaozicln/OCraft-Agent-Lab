'use client';

import { useEffect, useState } from 'react';
import type { DistillCard, StoryPack } from '@ocraft/shared';
import { apiFetch } from '@/lib/api';

type Step = 'input' | 'confirm';
type Entry = 'brief' | 'card';

type Props = {
  open: boolean;
  token: string;
  pack: StoryPack;
  /** 更新已有 NPC 时传入；新建则 null */
  targetNpcId: string | null;
  onClose: () => void;
  onApplied: (pack: StoryPack, summary: string) => void;
};

const emptyCard = (): DistillCard => ({
  name: '',
  core_traits: [],
  speech_patterns: [],
  typical_phrases: [],
  trigger_reactions: [],
  forbidden_behaviors: [],
});

function linesOf(arr: string[]): string {
  return arr.join('\n');
}

function parseLines(text: string): string[] {
  return text
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function reactionsToText(
  rows: DistillCard['trigger_reactions'],
): string {
  return rows.map((r) => `${r.situation} => ${r.reaction}`).join('\n');
}

function parseReactions(text: string): DistillCard['trigger_reactions'] {
  const out: DistillCard['trigger_reactions'] = [];
  for (const line of parseLines(text)) {
    const sep = line.includes('=>') ? '=>' : line.includes('→') ? '→' : null;
    if (!sep) continue;
    const [a, b] = line.split(sep);
    const situation = a?.trim();
    const reaction = b?.trim();
    if (situation && reaction) out.push({ situation, reaction });
  }
  return out;
}

export function PackDistillModal({
  open,
  token,
  pack,
  targetNpcId,
  onClose,
  onApplied,
}: Props) {
  const [entry, setEntry] = useState<Entry>('brief');
  const [step, setStep] = useState<Step>('input');
  const [brief, setBrief] = useState('');
  const [rawPaste, setRawPaste] = useState('');
  const [card, setCard] = useState<DistillCard>(emptyCard());
  const [source, setSource] = useState<'llm' | 'mock' | 'import' | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEntry('brief');
    setStep('input');
    setBrief('');
    setRawPaste('');
    setCard(emptyCard());
    setSource(null);
    setWarnings([]);
    setOverwrite(false);
    setBusy(false);
    setError(null);
  }, [open, targetNpcId]);

  if (!open) return null;

  const mode = targetNpcId ? 'update' : 'create';

  const runBrief = async () => {
    if (!brief.trim()) {
      setError('请先写一两句人设短描述');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{
        card: DistillCard;
        source: 'llm' | 'mock';
      }>('/packs/distill/brief', {
        token,
        method: 'POST',
        body: {
          brief: brief.trim(),
          pack,
          target_npc_id: targetNpcId ?? undefined,
        },
      });
      setCard(res.card);
      setSource(res.source);
      setWarnings([]);
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const runNormalize = async () => {
    if (!rawPaste.trim()) {
      setError('请粘贴 JSON 或简易 YAML 蒸馏卡');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{
        card: DistillCard;
        warnings: string[];
      }>('/packs/distill/normalize', {
        token,
        method: 'POST',
        body: { raw: rawPaste },
      });
      setCard({
        ...res.card,
        npc_id: res.card.npc_id || targetNpcId || undefined,
      });
      setSource('import');
      setWarnings(res.warnings ?? []);
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const runApply = async () => {
    if (!card.name.trim()) {
      setError('名字不能为空');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{
        pack: StoryPack;
        applied_summary: string;
      }>('/packs/distill/apply', {
        token,
        method: 'POST',
        body: {
          pack,
          card,
          mode,
          target_npc_id: targetNpcId ?? undefined,
          overwrite: mode === 'create' ? overwrite : undefined,
        },
      });
      onApplied(res.pack, res.applied_summary);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'var(--ui-overlay)' }}
      role="dialog"
      aria-modal="true"
      aria-label="人设蒸馏"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border shadow-lg"
        style={{
          background: 'var(--ui-panel)',
          borderColor: 'var(--ui-border)',
          color: 'var(--ui-fg)',
        }}
      >
        <div
          className="flex items-start justify-between gap-3 border-b px-4 py-3"
          style={{ borderColor: 'var(--ui-border)' }}
        >
          <div>
            <h2 className="text-lg font-semibold">
              人设蒸馏
              <span
                className="ml-2 text-sm font-normal"
                style={{ color: 'var(--ui-fg-muted)' }}
              >
                （确认后才写入 Pack NPC）
              </span>
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--ui-fg-muted)' }}>
              {mode === 'update'
                ? `更新：${targetNpcId}`
                : '新建 NPC'}
              {source === 'mock' ? ' · 当前为 MOCK 草稿' : ''}
              {source === 'llm' ? ' · LLM 草稿' : ''}
              {source === 'import' ? ' · 导入卡' : ''}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border px-2 py-1 text-sm"
            style={{ borderColor: 'var(--ui-border)' }}
            onClick={onClose}
            disabled={busy}
          >
            关闭
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
          {step === 'input' && (
            <>
              <div className="flex gap-2 text-sm">
                <button
                  type="button"
                  className="rounded-lg border px-3 py-1.5"
                  style={{
                    borderColor: 'var(--ui-border)',
                    background:
                      entry === 'brief' ? 'var(--ui-input)' : 'transparent',
                  }}
                  onClick={() => setEntry('brief')}
                  disabled={busy}
                >
                  短描述蒸馏
                </button>
                <button
                  type="button"
                  className="rounded-lg border px-3 py-1.5"
                  style={{
                    borderColor: 'var(--ui-border)',
                    background:
                      entry === 'card' ? 'var(--ui-input)' : 'transparent',
                  }}
                  onClick={() => setEntry('card')}
                  disabled={busy}
                >
                  粘贴已蒸馏卡
                </button>
              </div>

              {entry === 'brief' ? (
                <label className="block text-sm">
                  <span style={{ color: 'var(--ui-fg-muted)' }}>
                    一两句人设（稀疏也可以）
                  </span>
                  <textarea
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    style={{
                      background: 'var(--ui-input)',
                      borderColor: 'var(--ui-border)',
                      color: 'var(--ui-fg)',
                      minHeight: 100,
                    }}
                    value={brief}
                    disabled={busy}
                    onChange={(e) => setBrief(e.target.value)}
                    placeholder="例：叫阿黎，冷淡短句，讨厌被追问过去，喜欢雨声"
                  />
                </label>
              ) : (
                <label className="block text-sm">
                  <span style={{ color: 'var(--ui-fg-muted)' }}>
                    JSON 或简易 YAML
                  </span>
                  <textarea
                    className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-xs"
                    style={{
                      background: 'var(--ui-input)',
                      borderColor: 'var(--ui-border)',
                      color: 'var(--ui-fg)',
                      minHeight: 180,
                    }}
                    value={rawPaste}
                    disabled={busy}
                    onChange={(e) => setRawPaste(e.target.value)}
                    placeholder={`name: 阿黎\ncore_traits:\n  - 冷淡\n  - 短句\nforbidden_behaviors:\n  - 自称AI`}
                  />
                </label>
              )}
            </>
          )}

          {step === 'confirm' && (
            <div className="space-y-3 text-sm">
              {warnings.length > 0 && (
                <p style={{ color: 'var(--ui-fg-muted)' }}>
                  提示：{warnings.join('；')}
                </p>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <label>
                  <span style={{ color: 'var(--ui-fg-muted)' }}>名字</span>
                  <input
                    className="mt-1 w-full rounded-lg border px-2 py-1.5"
                    style={{
                      background: 'var(--ui-input)',
                      borderColor: 'var(--ui-border)',
                      color: 'var(--ui-fg)',
                    }}
                    value={card.name}
                    disabled={busy}
                    onChange={(e) =>
                      setCard((c) => ({ ...c, name: e.target.value }))
                    }
                  />
                </label>
                <label>
                  <span style={{ color: 'var(--ui-fg-muted)' }}>
                    npc_id（可选）
                  </span>
                  <input
                    className="mt-1 w-full rounded-lg border px-2 py-1.5"
                    style={{
                      background: 'var(--ui-input)',
                      borderColor: 'var(--ui-border)',
                      color: 'var(--ui-fg)',
                    }}
                    value={card.npc_id ?? ''}
                    disabled={busy || mode === 'update'}
                    onChange={(e) =>
                      setCard((c) => ({
                        ...c,
                        npc_id: e.target.value.trim() || undefined,
                      }))
                    }
                  />
                </label>
              </div>
              <label className="block">
                <span style={{ color: 'var(--ui-fg-muted)' }}>
                  核心特质（一行一条）
                </span>
                <textarea
                  className="mt-1 w-full rounded-lg border px-2 py-1.5"
                  style={{
                    background: 'var(--ui-input)',
                    borderColor: 'var(--ui-border)',
                    color: 'var(--ui-fg)',
                    minHeight: 64,
                  }}
                  value={linesOf(card.core_traits)}
                  disabled={busy}
                  onChange={(e) =>
                    setCard((c) => ({
                      ...c,
                      core_traits: parseLines(e.target.value),
                    }))
                  }
                />
              </label>
              <label className="block">
                <span style={{ color: 'var(--ui-fg-muted)' }}>
                  话风（一行一条）
                </span>
                <textarea
                  className="mt-1 w-full rounded-lg border px-2 py-1.5"
                  style={{
                    background: 'var(--ui-input)',
                    borderColor: 'var(--ui-border)',
                    color: 'var(--ui-fg)',
                    minHeight: 56,
                  }}
                  value={linesOf(card.speech_patterns)}
                  disabled={busy}
                  onChange={(e) =>
                    setCard((c) => ({
                      ...c,
                      speech_patterns: parseLines(e.target.value),
                    }))
                  }
                />
              </label>
              <label className="block">
                <span style={{ color: 'var(--ui-fg-muted)' }}>
                  典型句 → memories（一行一条）
                </span>
                <textarea
                  className="mt-1 w-full rounded-lg border px-2 py-1.5"
                  style={{
                    background: 'var(--ui-input)',
                    borderColor: 'var(--ui-border)',
                    color: 'var(--ui-fg)',
                    minHeight: 64,
                  }}
                  value={linesOf(card.typical_phrases)}
                  disabled={busy}
                  onChange={(e) =>
                    setCard((c) => ({
                      ...c,
                      typical_phrases: parseLines(e.target.value),
                    }))
                  }
                />
              </label>
              <label className="block">
                <span style={{ color: 'var(--ui-fg-muted)' }}>
                  软反应（每行：情境 =&gt; 反应）
                </span>
                <textarea
                  className="mt-1 w-full rounded-lg border px-2 py-1.5"
                  style={{
                    background: 'var(--ui-input)',
                    borderColor: 'var(--ui-border)',
                    color: 'var(--ui-fg)',
                    minHeight: 72,
                  }}
                  value={reactionsToText(card.trigger_reactions)}
                  disabled={busy}
                  onChange={(e) =>
                    setCard((c) => ({
                      ...c,
                      trigger_reactions: parseReactions(e.target.value),
                    }))
                  }
                />
              </label>
              <label className="block">
                <span style={{ color: 'var(--ui-fg-muted)' }}>
                  禁忌（一行一条）
                </span>
                <textarea
                  className="mt-1 w-full rounded-lg border px-2 py-1.5"
                  style={{
                    background: 'var(--ui-input)',
                    borderColor: 'var(--ui-border)',
                    color: 'var(--ui-fg)',
                    minHeight: 56,
                  }}
                  value={linesOf(card.forbidden_behaviors)}
                  disabled={busy}
                  onChange={(e) =>
                    setCard((c) => ({
                      ...c,
                      forbidden_behaviors: parseLines(e.target.value),
                    }))
                  }
                />
              </label>
              {mode === 'create' && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={overwrite}
                    disabled={busy}
                    onChange={(e) => setOverwrite(e.target.checked)}
                  />
                  id 冲突时覆盖已有 NPC
                </label>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm" style={{ color: 'var(--ui-danger, #c44)' }}>
              {error}
            </p>
          )}
        </div>

        <div
          className="flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3"
          style={{ borderColor: 'var(--ui-border)' }}
        >
          {step === 'confirm' && (
            <button
              type="button"
              className="rounded-lg border px-3 py-1.5 text-sm"
              style={{ borderColor: 'var(--ui-border)' }}
              disabled={busy}
              onClick={() => {
                setStep('input');
                setError(null);
              }}
            >
              返回
            </button>
          )}
          {step === 'input' && (
            <button
              type="button"
              className="rounded-lg border px-3 py-1.5 text-sm font-medium"
              style={{
                borderColor: 'var(--ui-border)',
                background: 'var(--ui-input)',
              }}
              disabled={busy}
              onClick={() => void (entry === 'brief' ? runBrief() : runNormalize())}
            >
              {busy ? '处理中…' : '生成草稿'}
            </button>
          )}
          {step === 'confirm' && (
            <button
              type="button"
              className="rounded-lg border px-3 py-1.5 text-sm font-medium"
              style={{
                borderColor: 'var(--ui-border)',
                background: 'var(--ui-input)',
              }}
              disabled={busy}
              onClick={() => void runApply()}
            >
              {busy ? '写入中…' : '确认写入草稿'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
