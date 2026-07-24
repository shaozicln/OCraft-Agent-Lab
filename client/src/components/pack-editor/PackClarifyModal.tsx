'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  PackClarifyAnswer,
  PackClarifySession,
  StoryPack,
} from '@ocraft/shared';

type AnswerDraft = {
  choice?: 'A' | 'B' | 'C';
  free_text: string;
};

type Props = {
  open: boolean;
  busy: boolean;
  session: PackClarifySession | null;
  error?: string | null;
  onClose: () => void;
  /** 不接受以上建议：不写入澄清，直接落盘/继续 */
  onForceSave: () => void;
  /** 提交当前内容：已填写入，未填自动跳过 */
  onSubmit: (answers: PackClarifyAnswer[]) => void;
  onPolish: (opts: {
    question_id: string;
    draft_text: string;
    topic: string;
    ask: string;
    target_hint?: string;
  }) => Promise<string | null>;
};

function buildPolishDraft(
  q: PackClarifySession['questions'][number],
  d: AnswerDraft,
): string {
  const optLabel =
    q.options.find((o) => o.key === d.choice)?.label?.trim() ?? '';
  const free = d.free_text.trim();
  if (optLabel && free) return `${optLabel}；${free}`;
  if (free) return free;
  if (optLabel) return optLabel;
  return '';
}

export function PackClarifyModal({
  open,
  busy,
  session,
  error,
  onClose,
  onForceSave,
  onSubmit,
  onPolish,
}: Props) {
  const [drafts, setDrafts] = useState<Record<string, AnswerDraft>>({});
  const [polishBusy, setPolishBusy] = useState<string | null>(null);
  const [polishAllBusy, setPolishAllBusy] = useState(false);

  const questions = session?.questions ?? [];
  const sessionKey = session
    ? `${session.source}:${session.questions.map((q) => q.id).join(',')}`
    : '';

  useEffect(() => {
    setDrafts({});
    setPolishBusy(null);
    setPolishAllBusy(false);
  }, [sessionKey]);

  const answersPayload = useMemo((): PackClarifyAnswer[] => {
    return questions
      .map((q) => {
        const d = drafts[q.id];
        if (!d) return null;
        if (!d.choice && !d.free_text.trim()) return null;
        return {
          question_id: q.id,
          choice: d.choice,
          free_text: d.free_text.trim() || undefined,
        };
      })
      .filter(Boolean) as PackClarifyAnswer[];
  }, [drafts, questions]);

  const polishOne = async (
    q: PackClarifySession['questions'][number],
    d: AnswerDraft,
  ): Promise<string | null> => {
    const draft = buildPolishDraft(q, d);
    if (!draft || q.allow_polish === false) return null;
    return onPolish({
      question_id: q.id,
      draft_text: draft,
      topic: q.topic,
      ask: q.ask,
      target_hint: q.target_hint,
    });
  };

  const handlePolishOne = async (q: PackClarifySession['questions'][number]) => {
    const d = drafts[q.id] ?? { free_text: '' };
    if (!buildPolishDraft(q, d)) return;
    setPolishBusy(q.id);
    try {
      const polished = await polishOne(q, d);
      if (polished) {
        setDrafts((prev) => ({
          ...prev,
          [q.id]: {
            choice: (prev[q.id] ?? d).choice,
            free_text: polished,
          },
        }));
      }
    } finally {
      setPolishBusy(null);
    }
  };

  const handlePolishAll = async () => {
    if (!session || polishAllBusy) return;
    setPolishAllBusy(true);
    try {
      const next = { ...drafts };
      for (const q of questions) {
        if (q.allow_polish === false) continue;
        const d = next[q.id] ?? { free_text: '' };
        if (!buildPolishDraft(q, d)) continue;
        setPolishBusy(q.id);
        const polished = await polishOne(q, d);
        if (polished) {
          next[q.id] = { choice: d.choice, free_text: polished };
          setDrafts({ ...next });
        }
      }
    } finally {
      setPolishBusy(null);
      setPolishAllBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'var(--ui-overlay)' }}
      role="dialog"
      aria-modal="true"
      aria-label="设定澄清"
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
              设定澄清
              <span
                className="ml-2 text-sm font-normal"
                style={{ color: 'var(--ui-fg-muted)' }}
              >
                （Clarify：生成/保存前把糊设定问清楚）
              </span>
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--ui-fg-muted)' }}>
              每题补充框右上角可单独润色；底部可一键全部润色。
              {session?.source === 'mock'
                ? ' 当前为演示题（MOCK：无真模型时的假数据）。'
                : ''}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border px-2 py-1 text-sm"
            style={{ borderColor: 'var(--ui-border)' }}
            onClick={onClose}
            disabled={busy || polishAllBusy}
          >
            关闭
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
          {session && (
            <section
              className="rounded-lg border p-3 text-sm"
              style={{ borderColor: 'var(--ui-border)' }}
            >
              <p className="text-xs" style={{ color: 'var(--ui-fg-muted)' }}>
                设定简述（summary）
              </p>
              <p className="mt-1 font-medium">
                {session.summary.world_one_liner}
              </p>
              {session.summary.chapters.length > 0 && (
                <p className="mt-1" style={{ color: 'var(--ui-fg-muted)' }}>
                  章节：{session.summary.chapters.join(' · ')}
                </p>
              )}
              {session.summary.npcs.length > 0 && (
                <p style={{ color: 'var(--ui-fg-muted)' }}>
                  角色（NPC）：{session.summary.npcs.join(' · ')}
                </p>
              )}
              {session.summary.risks.length > 0 && (
                <>
                  <p
                    className="mt-2 text-xs"
                    style={{ color: 'var(--ui-fg-muted)' }}
                  >
                    风险 / 歧义点（risks）
                  </p>
                  <ul className="mt-1 list-disc pl-5">
                    {session.summary.risks.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          {!session && (
            <p className="text-sm" style={{ color: 'var(--ui-fg-muted)' }}>
              正在生成澄清问题…
            </p>
          )}

          {questions.map((q, idx) => {
            const d = drafts[q.id] ?? { free_text: '' };
            const polishDraft = buildPolishDraft(q, d);
            const canPolish =
              q.allow_polish !== false && polishDraft.length > 0;
            const showSupplement =
              q.allow_free_text !== false || q.allow_polish !== false;

            return (
              <section
                key={q.id}
                className="rounded-lg border p-3"
                style={{ borderColor: 'var(--ui-border)' }}
              >
                <p className="text-xs" style={{ color: 'var(--ui-fg-muted)' }}>
                  第 {idx + 1} 题 · {q.topic}
                </p>
                <p className="mt-1 text-sm font-medium">{q.ask}</p>

                <p
                  className="mt-2 text-xs"
                  style={{ color: 'var(--ui-fg-muted)' }}
                >
                  快捷选项（选 C 表示暂不确定、本条不改设定）
                </p>
                <div className="mt-1 flex flex-col gap-1.5">
                  {q.options.map((opt) => (
                    <label
                      key={opt.key}
                      className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm"
                      style={{
                        background:
                          d.choice === opt.key
                            ? 'var(--ui-input)'
                            : 'transparent',
                      }}
                    >
                      <input
                        type="radio"
                        name={`clarify-${q.id}`}
                        checked={d.choice === opt.key}
                        disabled={busy || polishAllBusy}
                        onChange={() =>
                          setDrafts((prev) => ({
                            ...prev,
                            [q.id]: { ...d, choice: opt.key },
                          }))
                        }
                      />
                      <span>
                        <strong>{opt.key}.</strong> {opt.label}
                      </span>
                    </label>
                  ))}
                </div>

                {showSupplement && (
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <label
                        className="text-xs"
                        style={{ color: 'var(--ui-fg-muted)' }}
                      >
                        本题补充（可选；润色结果写在框内）
                      </label>
                      {q.allow_polish !== false && (
                        <button
                          type="button"
                          className="shrink-0 rounded-md border px-2 py-0.5 text-xs"
                          style={{ borderColor: 'var(--ui-border)' }}
                          disabled={
                            busy ||
                            polishAllBusy ||
                            !canPolish ||
                            polishBusy === q.id
                          }
                          title={
                            canPolish
                              ? '只润色本题'
                              : '请先选一个选项或填写补充'
                          }
                          onClick={() => void handlePolishOne(q)}
                        >
                          {polishBusy === q.id ? '润色中…' : 'AI 润色'}
                        </button>
                      )}
                    </div>
                    <textarea
                      className="min-h-[3.5rem] w-full rounded-lg border px-3 py-2 text-sm outline-none"
                      style={{
                        background: 'var(--ui-input)',
                        borderColor: 'var(--ui-border)',
                        color: 'var(--ui-fg)',
                      }}
                      placeholder="可补充细节；也可先选 ABC，再点右上角「AI 润色」"
                      value={d.free_text}
                      disabled={busy || polishAllBusy}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [q.id]: { ...d, free_text: e.target.value },
                        }))
                      }
                    />
                  </div>
                )}
              </section>
            );
          })}

          {error && (
            <p
              className="text-sm"
              style={{ color: 'var(--ui-danger, #dc2626)' }}
            >
              {error}
            </p>
          )}
        </div>

        <div
          className="flex flex-wrap justify-end gap-2 border-t px-4 py-3"
          style={{ borderColor: 'var(--ui-border)' }}
        >
          <button
            type="button"
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--ui-border)' }}
            disabled={busy || polishAllBusy || !session}
            title="按顺序润色每一道已有选项/补充的题"
            onClick={() => void handlePolishAll()}
          >
            {polishAllBusy ? '全部润色中…' : '一键全部润色'}
          </button>
          <button
            type="button"
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--ui-border)' }}
            disabled={busy || polishAllBusy}
            title="不把澄清答案写入 Pack，按当前草稿继续/落盘"
            onClick={onForceSave}
          >
            不接受以上建议
          </button>
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
            style={{
              background: 'var(--ui-accent)',
              color: 'var(--ui-accent-fg)',
            }}
            disabled={busy || polishAllBusy || !session}
            title="已填的写入 Pack；没填的题自动跳过"
            onClick={() => onSubmit(answersPayload)}
          >
            {busy ? '处理中…' : '提交当前内容'}
            {!busy && (
              <span className="mt-0.5 block text-[11px] font-normal opacity-90">
                （没填的自动跳过）
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export type PackClarifyModalPack = StoryPack;
