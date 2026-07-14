'use client';

import type { StoryMapEdge, StoryMapEvent } from '@ocraft/shared';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

type RestartTarget =
  | { kind: 'chapter'; chapterId: string; label: string }
  | { kind: 'edge'; ruleId: string; label: string; toLabel: string };

const NODE_W = 148;
const NODE_H = 72;
const GAP_X = 96;
const PAD_X = 64;
const LANE_H = 120;

function chapterShort(map: StoryMapEvent, id: string): string {
  const c = map.chapters.find((x) => x.id === id);
  return c ? `第${c.rank + 1}章：${c.display_name}` : id;
}

function shortEdgeLabel(label: string, max = 12): string {
  const t = label.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

type Pos = { x: number; y: number; cx: number; cy: number; lane: number; col: number };

function buildLayout(map: StoryMapEvent) {
  const chapters = [...map.chapters].sort((a, b) => a.rank - b.rank);
  const colOf = new Map(chapters.map((c, i) => [c.id, i]));
  const laneOf = new Map<string, number>(chapters.map((c) => [c.id, 0]));

  const outs = new Map<string, StoryMapEdge[]>();
  for (const e of map.edges) {
    if (!e.to) continue;
    const list = outs.get(e.from) ?? [];
    list.push(e);
    outs.set(e.from, list);
  }

  for (const [, edges] of outs) {
    const tos = [...new Set(edges.map((e) => e.to!).filter(Boolean))];
    if (tos.length < 2) continue;
    tos.forEach((to, i) => {
      const lane =
        tos.length === 2
          ? i === 0
            ? -1
            : 1
          : i === 0
            ? 0
            : i % 2 === 1
              ? Math.ceil(i / 2)
              : -Math.ceil(i / 2);
      // 已有非 0 则保留更靠外的
      const prev = laneOf.get(to) ?? 0;
      if (prev === 0 || Math.abs(lane) > Math.abs(prev)) {
        laneOf.set(to, lane);
      }
    });
  }

  // 单入边继承来源 lane（合流前支线保持高度）
  for (const e of map.edges) {
    if (!e.to) continue;
    const siblings = (outs.get(e.from) ?? []).filter((x) => x.to);
    if (siblings.length !== 1) continue;
    const fromLane = laneOf.get(e.from) ?? 0;
    if ((laneOf.get(e.to) ?? 0) === 0 && fromLane !== 0) {
      laneOf.set(e.to, fromLane);
    }
  }

  const maxLane = Math.max(1, ...[...laneOf.values()].map((v) => Math.abs(v)));
  const centerY = PAD_X + maxLane * LANE_H + NODE_H / 2;

  const positions = new Map<string, Pos>();
  for (const c of chapters) {
    const col = colOf.get(c.id) ?? 0;
    const lane = laneOf.get(c.id) ?? 0;
    const x = PAD_X + col * (NODE_W + GAP_X);
    const y = centerY + lane * LANE_H - NODE_H / 2;
    positions.set(c.id, {
      x,
      y,
      cx: x + NODE_W / 2,
      cy: y + NODE_H / 2,
      lane,
      col,
    });
  }

  const width =
    PAD_X * 2 +
    chapters.length * NODE_W +
    Math.max(chapters.length - 1, 0) * GAP_X;
  const height = centerY + maxLane * LANE_H + NODE_H / 2 + PAD_X;

  return { chapters, positions, width, height, centerY };
}

function edgePath(
  from: Pos,
  to: Pos | null,
  stubLane: number,
): { d: string; midX: number; midY: number } {
  const x1 = from.x + NODE_W;
  const y1 = from.cy;
  if (!to) {
    const x2 = x1 + GAP_X * 0.45;
    const y2 = y1 + stubLane * 28;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    return {
      d: `M ${x1} ${y1} Q ${midX} ${y1}, ${x2} ${y2}`,
      midX,
      midY,
    };
  }
  const x2 = to.x;
  const y2 = to.cy;
  const dx = Math.max(x2 - x1, 40);
  const c1x = x1 + dx * 0.4;
  const c2x = x2 - dx * 0.4;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  return {
    d: `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`,
    midX,
    midY,
  };
}

/** Esc：按钮；点开整屏留缝故事线弹窗 */
export function StoryProgressMap({
  map,
  onRestart,
  busy,
  onOpen,
}: {
  map: StoryMapEvent | null;
  onRestart: (opts: {
    chapterId?: string;
    viaRuleId?: string;
    displayName?: string;
  }) => void;
  busy?: boolean;
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="group w-full rounded-xl border px-3 py-2.5 text-left transition hover:brightness-[1.03]"
        style={{
          borderColor: 'var(--ui-border)',
          background: 'var(--ui-bg-elevated)',
          color: 'var(--ui-fg)',
        }}
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">剧情进度</span>
          <span
            className="text-xs transition group-hover:translate-x-0.5"
            style={{ color: 'var(--ui-accent)' }}
          >
            打开 →
          </span>
        </span>
        <span
          className="mt-0.5 block text-xs"
          style={{ color: 'var(--ui-fg-muted)' }}
        >
          横向故事线 · 分歧支点 · 新开存档
        </span>
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <StorylineModal
            map={map}
            busy={busy}
            onClose={() => setOpen(false)}
            onRestart={(opts) => {
              onRestart(opts);
              setOpen(false);
            }}
          />,
          document.body,
        )}
    </>
  );
}

function StorylineModal({
  map,
  busy,
  onClose,
  onRestart,
}: {
  map: StoryMapEvent | null;
  busy?: boolean;
  onClose: () => void;
  onRestart: (opts: {
    chapterId?: string;
    viaRuleId?: string;
    displayName?: string;
  }) => void;
}) {
  const [pending, setPending] = useState<RestartTarget | null>(null);
  const [slotName, setSlotName] = useState('');
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pending) {
          setPending(null);
          setSlotName('');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pending]);

  const layout = useMemo(() => (map ? buildLayout(map) : null), [map]);

  const flagList = useMemo(() => {
    if (!map) return [];
    return Object.entries(map.flags).filter(([, v]) => v && v !== 'false');
  }, [map]);

  const relatedEdgeIds = useMemo(() => {
    if (!map) return new Set<string>();
    const cur = map.current_chapter;
    return new Set(
      map.edges
        .filter((e) => e.from === cur || e.to === cur)
        .map((e) => e.id),
    );
  }, [map]);

  const confirm = () => {
    if (!pending) return;
    const name = slotName.trim() || undefined;
    if (pending.kind === 'chapter') {
      onRestart({ chapterId: pending.chapterId, displayName: name });
    } else {
      onRestart({ viaRuleId: pending.ruleId, displayName: name });
    }
    setPending(null);
    setSlotName('');
  };

  const firstChapter = map
    ? [...map.chapters].sort((a, b) => a.rank - b.rank)[0]
    : undefined;

  return (
    <div
      className="fixed inset-0 z-[200] flex p-4 sm:p-6 md:p-8"
      style={{
        background: entered ? 'rgba(8,10,14,0.58)' : 'rgba(8,10,14,0)',
        backdropFilter: entered ? 'blur(6px)' : 'blur(0px)',
        transition: 'background 220ms ease, backdrop-filter 220ms ease',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="故事线"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div
        className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          background: 'var(--ui-panel-solid)',
          borderColor: 'var(--ui-border)',
          color: 'var(--ui-fg)',
          opacity: entered ? 1 : 0,
          transform: entered ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.985)',
          transition: 'opacity 240ms ease, transform 280ms cubic-bezier(.22,1,.36,1)',
        }}
      >
        <header
          className="flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4 sm:px-6"
          style={{ borderColor: 'var(--ui-border)' }}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">故事线</h2>
              {map && (
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                  style={{
                    background:
                      'color-mix(in srgb, var(--ui-accent) 16%, transparent)',
                    color: 'var(--ui-accent)',
                  }}
                >
                  {chapterShort(map, map.current_chapter)}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--ui-fg-muted)' }}>
              {map
                ? flagList.length > 0
                  ? `已置 flag：${flagList.map(([k]) => k).join(' · ')}`
                  : '尚未置任何剧情 flag'
                : '正在同步进度…'}
              <span className="mx-1.5 opacity-40">|</span>
              点击章节或支点，可从该处分叉新开存档
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {firstChapter && map && (
              <button
                type="button"
                disabled={busy}
                className="rounded-lg border px-3 py-2 text-xs font-medium transition hover:brightness-110 disabled:opacity-50"
                style={{
                  borderColor: 'var(--ui-border)',
                  color: 'var(--ui-accent)',
                }}
                onClick={() => {
                  setPending({
                    kind: 'chapter',
                    chapterId: firstChapter.id,
                    label: chapterShort(map, firstChapter.id),
                  });
                  setSlotName('');
                }}
              >
                从第一章新开
              </button>
            )}
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-xs transition hover:opacity-80"
              style={{ color: 'var(--ui-fg-muted)' }}
              onClick={onClose}
            >
              关闭 Esc
            </button>
          </div>
        </header>

        <div
          className="relative min-h-0 flex-1 overflow-auto"
          style={{
            background:
              'radial-gradient(1200px 480px at 20% 40%, color-mix(in srgb, var(--ui-accent) 7%, transparent), transparent 60%), var(--ui-panel-solid)',
          }}
        >
          {!map || !layout ? (
            <div
              className="flex h-full min-h-[280px] items-center justify-center text-sm"
              style={{ color: 'var(--ui-fg-muted)' }}
            >
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                加载故事线…
              </span>
            </div>
          ) : (
            <div
              className="relative mx-auto my-8"
              style={{
                width: Math.max(layout.width, 640),
                height: Math.max(layout.height, 320),
                minWidth: '100%',
              }}
            >
              <svg
                className="pointer-events-none absolute inset-0"
                width={Math.max(layout.width, 640)}
                height={Math.max(layout.height, 320)}
                aria-hidden
              >
                <defs>
                  <linearGradient id="story-edge" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="var(--ui-accent)" stopOpacity="0.15" />
                    <stop offset="50%" stopColor="var(--ui-accent)" stopOpacity="0.55" />
                    <stop offset="100%" stopColor="var(--ui-accent)" stopOpacity="0.15" />
                  </linearGradient>
                </defs>

                {/* 主轴参考 */}
                <line
                  x1={PAD_X - 8}
                  y1={layout.centerY}
                  x2={layout.width - PAD_X + 8}
                  y2={layout.centerY}
                  stroke="currentColor"
                  strokeOpacity={0.08}
                  strokeWidth={3}
                  strokeLinecap="round"
                />

                {map.edges.map((edge, ei) => {
                  const from = layout.positions.get(edge.from);
                  if (!from) return null;
                  const to = edge.to ? layout.positions.get(edge.to) : null;
                  const stubs = map.edges.filter(
                    (e) => e.from === edge.from && !e.to,
                  );
                  const stubIdx = stubs.indexOf(edge);
                  const stubLane = stubIdx < 0 ? 0 : stubIdx % 2 === 0 ? 1 : -1;
                  const { d, midX, midY } = edgePath(from, to, stubLane);
                  const hot =
                    hoverEdge === edge.id || relatedEdgeIds.has(edge.id);
                  return (
                    <g key={edge.id} className="pointer-events-auto">
                      <path
                        d={d}
                        fill="none"
                        stroke={hot ? 'url(#story-edge)' : 'currentColor'}
                        strokeOpacity={hot ? 1 : 0.22}
                        strokeWidth={hot ? 3 : 2}
                        strokeLinecap="round"
                        style={{
                          transition:
                            'stroke-opacity 160ms ease, stroke-width 160ms ease',
                          animation: entered
                            ? `story-draw 520ms ease ${ei * 40}ms both`
                            : undefined,
                        }}
                      />
                      <g
                        className="cursor-pointer"
                        onMouseEnter={() => setHoverEdge(edge.id)}
                        onMouseLeave={() => setHoverEdge(null)}
                        onClick={() => {
                          if (busy) return;
                          setPending({
                            kind: 'edge',
                            ruleId: edge.id,
                            label: edge.label,
                            toLabel: edge.to
                              ? chapterShort(map, edge.to)
                              : '（同章置 flag）',
                          });
                          setSlotName('');
                        }}
                      >
                        <rect
                          x={midX - 52}
                          y={midY - 14}
                          width={104}
                          height={28}
                          rx={14}
                          fill="var(--ui-panel-solid)"
                          stroke={
                            hot ? 'var(--ui-accent)' : 'var(--ui-border)'
                          }
                          strokeWidth={hot ? 1.5 : 1}
                          style={{ transition: 'stroke 160ms ease' }}
                        />
                        <text
                          x={midX}
                          y={midY + 4}
                          textAnchor="middle"
                          fontSize={10}
                          fill="currentColor"
                          opacity={0.75}
                        >
                          {shortEdgeLabel(edge.label)}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </svg>

              {layout.chapters.map((ch, i) => {
                const pos = layout.positions.get(ch.id)!;
                const active = ch.id === map.current_chapter;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setPending({
                        kind: 'chapter',
                        chapterId: ch.id,
                        label: chapterShort(map, ch.id),
                      });
                      setSlotName('');
                    }}
                    className="absolute flex flex-col items-stretch justify-center rounded-2xl border px-3 py-2 text-left transition disabled:opacity-50"
                    style={{
                      left: pos.x,
                      top: pos.y,
                      width: NODE_W,
                      height: NODE_H,
                      borderColor: active
                        ? 'var(--ui-accent)'
                        : 'var(--ui-border)',
                      background: active
                        ? 'color-mix(in srgb, var(--ui-accent) 14%, var(--ui-panel-solid))'
                        : 'var(--ui-bg-elevated)',
                      boxShadow: active
                        ? '0 8px 28px color-mix(in srgb, var(--ui-accent) 22%, transparent)'
                        : '0 4px 14px rgba(0,0,0,0.06)',
                      animation: entered
                        ? `story-node-in 420ms cubic-bezier(.22,1,.36,1) ${80 + i * 45}ms both`
                        : undefined,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <span
                      className="text-[10px] font-medium tracking-wide uppercase"
                      style={{ color: 'var(--ui-fg-muted)' }}
                    >
                      Chapter {ch.rank + 1}
                      {active ? ' · Now' : ''}
                    </span>
                    <span className="mt-0.5 truncate text-sm font-semibold leading-snug">
                      {ch.display_name}
                    </span>
                    {active && (
                      <span
                        className="mt-1 h-1 w-8 rounded-full"
                        style={{ background: 'var(--ui-accent)' }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <footer
          className="flex shrink-0 flex-wrap items-center gap-4 border-t px-5 py-3 text-[11px] sm:px-6"
          style={{
            borderColor: 'var(--ui-border)',
            color: 'var(--ui-fg-muted)',
          }}
        >
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: 'var(--ui-accent)' }}
            />
            当前章节
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-6 rounded-full border"
              style={{ borderColor: 'var(--ui-accent)' }}
            />
            分歧支点（可点）
          </span>
          <span className="ml-auto opacity-70">点击空白处或 Esc 关闭</span>
        </footer>
      </div>

      {pending && map && (
        <div
          className="absolute inset-0 z-[10] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setPending(null);
              setSlotName('');
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border p-5 shadow-2xl"
            style={{
              background: 'var(--ui-panel-solid)',
              borderColor: 'var(--ui-border)',
              color: 'var(--ui-fg)',
              animation: 'story-node-in 220ms ease both',
            }}
          >
            <h4 className="text-base font-semibold">从该节点新开存档？</h4>
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ color: 'var(--ui-fg-muted)' }}
            >
              {pending.kind === 'chapter'
                ? `新建独立槽，从「${pending.label}」开始；对话与好感重置，旧存档保留。`
                : `沿分歧「${pending.label}」进入「${pending.toLabel}」，并写入对应 flags。`}
            </p>
            <label className="mt-4 block text-xs">
              <span style={{ color: 'var(--ui-fg-muted)' }}>存档名（可选）</span>
              <input
                className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                style={{
                  background: 'var(--ui-input)',
                  borderColor: 'var(--ui-border)',
                  color: 'var(--ui-fg)',
                }}
                value={slotName}
                maxLength={64}
                autoFocus
                placeholder="例如：测结局甲 / 二章分歧"
                onChange={(e) => setSlotName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirm();
                }}
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-sm"
                style={{ color: 'var(--ui-fg-muted)' }}
                onClick={() => {
                  setPending(null);
                  setSlotName('');
                }}
              >
                取消
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
                style={{
                  background: 'var(--ui-accent)',
                  color: 'var(--ui-accent-fg)',
                }}
                onClick={confirm}
              >
                确认新开
              </button>
            </div>
          </div>
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes story-node-in {
          from { opacity: 0; transform: translateY(8px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes story-draw {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `,
        }}
      />
    </div>
  );
}
