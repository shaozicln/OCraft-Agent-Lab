'use client';

import type { StoryMapEdge, StoryMapEvent } from '@ocraft/shared';
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getBezierPath,
  useEdgesState,
  useNodesState,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@/theme/ThemeProvider';
import '@xyflow/react/dist/style.css';
import './story-progress.css';

type RestartTarget =
  | { kind: 'chapter'; chapterId: string; label: string }
  | { kind: 'edge'; ruleId: string; label: string; toLabel: string };

const NODE_W = 176;
const NODE_H = 90;
const GAP_X = 120;
const PAD_X = 48;
const LANE_H = 140;

type ChapterNodeData = {
  rank: number;
  displayName: string;
  active: boolean;
  busy?: boolean;
  onSelect: () => void;
};

type StubNodeData = Record<string, never>;

type StoryEdgeData = {
  label: string;
  related: boolean;
  busy?: boolean;
  onSelect: () => void;
};

function chapterShort(map: StoryMapEvent, id: string): string {
  const c = map.chapters.find((x) => x.id === id);
  return c ? `第${c.rank + 1}章：${c.display_name}` : id;
}

type Pos = { x: number; y: number; lane: number; col: number };

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
      const prev = laneOf.get(to) ?? 0;
      if (prev === 0 || Math.abs(lane) > Math.abs(prev)) {
        laneOf.set(to, lane);
      }
    });
  }

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
  const centerY = PAD_X + maxLane * LANE_H;

  const positions = new Map<string, Pos>();
  for (const c of chapters) {
    const col = colOf.get(c.id) ?? 0;
    const lane = laneOf.get(c.id) ?? 0;
    positions.set(c.id, {
      x: PAD_X + col * (NODE_W + GAP_X),
      y: centerY + lane * LANE_H - NODE_H / 2,
      lane,
      col,
    });
  }

  return { chapters, positions, centerY, laneOf };
}

const ChapterNode = memo(function ChapterNode({
  data,
}: NodeProps<Node<ChapterNodeData>>) {
  return (
    <div
      className="story-node-shell"
      style={{ width: NODE_W, height: NODE_H }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="story-handle"
        isConnectable={false}
      />
      <button
        type="button"
        className="story-node story-node--flow"
        data-active={data.active ? 'true' : 'false'}
        disabled={data.busy}
        onClick={(e) => {
          e.stopPropagation();
          data.onSelect();
        }}
      >
        <span className="story-node__rank">
          {String(data.rank + 1).padStart(2, '0')}
          {data.active ? ' · NOW' : ''}
        </span>
        <span className="story-node__name">{data.displayName}</span>
        {data.active && <span className="story-node__now" />}
      </button>
      <Handle
        type="source"
        position={Position.Right}
        className="story-handle"
        isConnectable={false}
      />
    </div>
  );
});

const StubNode = memo(function StubNode(_props: NodeProps<Node<StubNodeData>>) {
  return (
    <div className="story-stub-node" aria-hidden>
      <Handle
        type="target"
        position={Position.Left}
        className="story-handle"
        isConnectable={false}
      />
    </div>
  );
});

function StoryEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps<Edge<StoryEdgeData>>) {
  const [hover, setHover] = useState(false);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const hot = hover || Boolean(data?.related);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: hot
            ? 'var(--ui-accent)'
            : 'color-mix(in srgb, var(--ui-fg-muted) 55%, transparent)',
          strokeOpacity: hot ? 0.9 : 1,
          strokeWidth: hot ? 2.5 : 1.75,
          transition: 'stroke 160ms ease, stroke-width 160ms ease',
        }}
      />
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        strokeLinecap="round"
        className="react-flow__edge-interaction"
        style={{ cursor: data?.busy ? 'not-allowed' : 'pointer' }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => {
          if (data?.busy) return;
          data?.onSelect();
        }}
      />
      {hover && data?.label && (
        <EdgeLabelRenderer>
          <div
            className="story-edge-tip"
            style={{
              position: 'absolute',
              transform: `translate(-50%, calc(-100% - 10px)) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'none',
            }}
            role="tooltip"
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const nodeTypes = {
  chapter: ChapterNode,
  stub: StubNode,
};

const edgeTypes = {
  story: StoryEdge,
};

function mapToFlow(
  map: StoryMapEvent,
  busy: boolean | undefined,
  onChapter: (chapterId: string, label: string) => void,
  onEdge: (ruleId: string, label: string, toLabel: string) => void,
): { nodes: Node[]; edges: Edge[] } {
  const { chapters, positions, laneOf } = buildLayout(map);
  const related = new Set(
    map.edges
      .filter((e) => e.from === map.current_chapter || e.to === map.current_chapter)
      .map((e) => e.id),
  );

  const nodes: Node[] = chapters.map((c) => {
    const pos = positions.get(c.id)!;
    return {
      id: c.id,
      type: 'chapter',
      position: { x: pos.x, y: pos.y },
      data: {
        rank: c.rank,
        displayName: c.display_name,
        active: c.id === map.current_chapter,
        busy,
        onSelect: () => onChapter(c.id, chapterShort(map, c.id)),
      } satisfies ChapterNodeData,
      draggable: false,
      selectable: false,
    };
  });

  const edges: Edge[] = [];
  const stubsByFrom = new Map<string, StoryMapEdge[]>();
  for (const e of map.edges) {
    if (e.to) continue;
    const list = stubsByFrom.get(e.from) ?? [];
    list.push(e);
    stubsByFrom.set(e.from, list);
  }

  for (const [fromId, stubs] of stubsByFrom) {
    const fromPos = positions.get(fromId);
    if (!fromPos) continue;
    stubs.forEach((edge, stubIdx) => {
      const stubLane = stubIdx % 2 === 0 ? 1 : -1;
      const stubId = `stub:${edge.id}`;
      nodes.push({
        id: stubId,
        type: 'stub',
        position: {
          x: fromPos.x + NODE_W + GAP_X * 0.42,
          y: fromPos.y + NODE_H / 2 - 6 + stubLane * 28,
        },
        data: {},
        draggable: false,
        selectable: false,
      });
      edges.push({
        id: edge.id,
        type: 'story',
        source: fromId,
        target: stubId,
        data: {
          label: edge.label,
          related: related.has(edge.id),
          busy,
          onSelect: () => onEdge(edge.id, edge.label, '（同章置 flag）'),
        } satisfies StoryEdgeData,
      });
    });
  }

  for (const edge of map.edges) {
    if (!edge.to) continue;
    edges.push({
      id: edge.id,
      type: 'story',
      source: edge.from,
      target: edge.to,
      data: {
        label: edge.label,
        related: related.has(edge.id),
        busy,
        onSelect: () =>
          onEdge(edge.id, edge.label, chapterShort(map, edge.to!)),
      } satisfies StoryEdgeData,
    });
  }

  void laneOf;
  return { nodes, edges };
}

function StoryFlowCanvas({
  map,
  busy,
  onChapter,
  onEdge,
}: {
  map: StoryMapEvent;
  busy?: boolean;
  onChapter: (chapterId: string, label: string) => void;
  onEdge: (ruleId: string, label: string, toLabel: string) => void;
}) {
  const graph = useMemo(
    () => mapToFlow(map, busy, onChapter, onEdge),
    [map, busy, onChapter, onEdge],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);

  useEffect(() => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
  }, [graph, setNodes, setEdges]);

  const { theme } = useTheme();

  const onInit = useCallback((instance: { fitView: (opts?: object) => void }) => {
    // 容器量完尺寸后再 fit，避免首帧高度为 0 导致空白
    requestAnimationFrame(() => {
      instance.fitView({ padding: 0.22, duration: 200 });
    });
  }, []);

  return (
    <div className="story-flow-host" data-ui-theme={theme}>
      <ReactFlow
        className="story-flow"
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={onInit}
        fitView
        fitViewOptions={{ padding: 0.22 }}
        defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
        minZoom={0.25}
        maxZoom={1.75}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        zoomOnDoubleClick={false}
        proOptions={{ hideAttribution: true }}
        colorMode={theme}
      >
        <Background
          gap={24}
          size={1.1}
          color="color-mix(in srgb, var(--ui-fg-muted) 22%, transparent)"
        />
        <Controls showInteractive={false} className="story-flow__controls" />
      </ReactFlow>
    </div>
  );
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
        className="story-entry"
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
      >
        <span className="story-entry__row">
          <span>
            <span className="story-entry__eyebrow">Storyline</span>
            <span className="story-entry__title block">剧情进度</span>
          </span>
          <span className="story-entry__go">打开 →</span>
        </span>
        <span className="story-entry__lead">
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
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (pending) {
        setPending(null);
        setSlotName('');
      } else {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pending]);

  const flagList = useMemo(() => {
    if (!map) return [];
    return Object.entries(map.flags).filter(([, v]) => v && v !== 'false');
  }, [map]);

  const firstChapter = map
    ? [...map.chapters].sort((a, b) => a.rank - b.rank)[0]
    : undefined;

  const onChapter = useCallback((chapterId: string, label: string) => {
    setPending({ kind: 'chapter', chapterId, label });
    setSlotName('');
  }, []);

  const onEdge = useCallback(
    (ruleId: string, label: string, toLabel: string) => {
      setPending({ kind: 'edge', ruleId, label, toLabel });
      setSlotName('');
    },
    [],
  );

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

  return (
    <div
      className="story-modal-root"
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
        className="story-modal"
        style={{
          opacity: entered ? 1 : 0,
          transform: entered
            ? 'translateY(0) scale(1)'
            : 'translateY(10px) scale(0.985)',
          transition:
            'opacity 240ms ease, transform 280ms cubic-bezier(.22,1,.36,1)',
        }}
      >
        <header className="story-modal__head">
          <div className="min-w-0">
            <p className="story-modal__eyebrow">Storyboard</p>
            <h2 className="story-modal__title">故事线</h2>
            {map && (
              <span className="story-modal__badge">
                {chapterShort(map, map.current_chapter)}
              </span>
            )}
            <p className="story-modal__lead">
              {map
                ? flagList.length > 0
                  ? `已置 flag：${flagList.map(([k]) => k).join(' · ')}`
                  : '尚未置任何剧情 flag'
                : '正在同步进度…'}
              <span className="mx-1.5 opacity-40">|</span>
              拖拽平移 / 滚轮缩放；悬停连线看分歧；点击章节或支点可新开存档
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {firstChapter && map && (
              <button
                type="button"
                disabled={busy}
                className="story-modal__btn disabled:opacity-50"
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
              className="story-modal__btn story-modal__btn--ghost"
              onClick={onClose}
            >
              关闭 Esc
            </button>
          </div>
        </header>

        <div className="story-modal__canvas story-modal__canvas--flow">
          {!map ? (
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
            <ReactFlowProvider>
              <StoryFlowCanvas
                map={map}
                busy={busy}
                onChapter={onChapter}
                onEdge={onEdge}
              />
            </ReactFlowProvider>
          )}
        </div>

        <footer className="story-modal__foot">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: 'var(--ui-accent)' }}
            />
            当前章节
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-6 rounded-sm border"
              style={{ borderColor: 'var(--ui-accent)' }}
            />
            分歧支点（悬停看说明）
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
    </div>
  );
}
