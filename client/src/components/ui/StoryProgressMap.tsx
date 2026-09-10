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
  useReactFlow,
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

type Selection =
  | { kind: 'chapter'; chapterId: string }
  | { kind: 'edge'; ruleId: string };

type ChapterPhase = 'past' | 'now' | 'future';

const NODE_W = 176;
const NODE_H = 90;
const GAP_X = 120;
const PAD_X = 48;
const LANE_H = 140;

type ChapterNodeData = {
  rank: number;
  displayName: string;
  phase: ChapterPhase;
  selected: boolean;
  busy?: boolean;
  onSelect: () => void;
};

type StubNodeData = Record<string, never>;

type StoryEdgeData = {
  label: string;
  related: boolean;
  selected: boolean;
  busy?: boolean;
  onSelect: () => void;
};

function chapterShort(map: StoryMapEvent, id: string): string {
  const c = map.chapters.find((x) => x.id === id);
  return c ? `第${c.rank + 1}章：${c.display_name}` : id;
}

function currentChapter(map: StoryMapEvent) {
  return map.chapters.find((c) => c.id === map.current_chapter);
}

function phaseOf(map: StoryMapEvent, chapterId: string): ChapterPhase {
  const cur = currentChapter(map);
  const ch = map.chapters.find((c) => c.id === chapterId);
  if (!ch || !cur) return 'future';
  if (ch.id === cur.id) return 'now';
  return ch.rank < cur.rank ? 'past' : 'future';
}

function phaseLabel(phase: ChapterPhase) {
  if (phase === 'now') return '当前';
  if (phase === 'past') return '已过';
  return '未到';
}

function truncateLabel(text: string, max = 18) {
  const chars = Array.from(text.trim());
  if (chars.length <= max) return text.trim();
  return `${chars.slice(0, max - 1).join('')}…`;
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

  return { chapters, positions };
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
        data-phase={data.phase}
        data-selected={data.selected ? 'true' : 'false'}
        aria-current={data.phase === 'now' ? 'step' : undefined}
        aria-pressed={data.selected}
        disabled={data.busy}
        onClick={(e) => {
          e.stopPropagation();
          data.onSelect();
        }}
      >
        <span className="story-node__rank">
          {String(data.rank + 1).padStart(2, '0')}
          {data.phase === 'now' ? ' · 当前' : ''}
        </span>
        <span className="story-node__name">{data.displayName}</span>
        {data.phase === 'now' && <span className="story-node__now" />}
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
  const hot = hover || Boolean(data?.related) || Boolean(data?.selected);
  const label = data?.label?.trim() ?? '';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: data?.selected
            ? 'var(--ui-accent)'
            : hot
              ? 'color-mix(in srgb, var(--ui-accent) 75%, var(--ui-fg-muted))'
              : 'color-mix(in srgb, var(--ui-fg-muted) 55%, transparent)',
          strokeOpacity: hot ? 0.95 : 0.85,
          strokeWidth: data?.selected ? 2.75 : hot ? 2.25 : 1.6,
          strokeDasharray: data?.related || data?.selected ? undefined : '5 5',
        }}
      />
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={22}
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
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="story-edge-tip"
            data-hot={hot ? 'true' : 'false'}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'none',
            }}
          >
            {hover || data?.selected ? label : truncateLabel(label)}
          </div>
        </EdgeLabelRenderer>
      ) : null}
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
  selection: Selection | null,
  onChapter: (chapterId: string) => void,
  onEdge: (ruleId: string) => void,
): { nodes: Node[]; edges: Edge[] } {
  const { chapters, positions } = buildLayout(map);
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
        phase: phaseOf(map, c.id),
        selected:
          selection?.kind === 'chapter' && selection.chapterId === c.id,
        busy,
        onSelect: () => onChapter(c.id),
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
          selected: selection?.kind === 'edge' && selection.ruleId === edge.id,
          busy,
          onSelect: () => onEdge(edge.id),
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
        selected: selection?.kind === 'edge' && selection.ruleId === edge.id,
        busy,
        onSelect: () => onEdge(edge.id),
      } satisfies StoryEdgeData,
    });
  }

  return { nodes, edges };
}

function FitSelection({
  chapterId,
}: {
  chapterId: string | null;
}) {
  const rf = useReactFlow();

  useEffect(() => {
    if (!chapterId) return;
    const id = window.requestAnimationFrame(() => {
      const node = rf.getNode(chapterId);
      if (!node) {
        rf.fitView({ padding: 0.22, duration: 180 });
        return;
      }
      rf.setCenter(
        node.position.x + NODE_W / 2,
        node.position.y + NODE_H / 2,
        { zoom: 0.95, duration: 220 },
      );
    });
    return () => window.cancelAnimationFrame(id);
  }, [chapterId, rf]);

  return null;
}

function StoryFlowCanvas({
  map,
  busy,
  selection,
  onChapter,
  onEdge,
}: {
  map: StoryMapEvent;
  busy?: boolean;
  selection: Selection | null;
  onChapter: (chapterId: string) => void;
  onEdge: (ruleId: string) => void;
}) {
  const graph = useMemo(
    () => mapToFlow(map, busy, selection, onChapter, onEdge),
    [map, busy, selection, onChapter, onEdge],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);

  useEffect(() => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
  }, [graph, setNodes, setEdges]);

  const { theme } = useTheme();
  const focusId =
    selection?.kind === 'chapter'
      ? selection.chapterId
      : selection?.kind === 'edge'
        ? (map.edges.find((e) => e.id === selection.ruleId)?.from ??
          map.current_chapter)
        : map.current_chapter;

  const onInit = useCallback((instance: { fitView: (opts?: object) => void }) => {
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
        <FitSelection chapterId={focusId} />
      </ReactFlow>
    </div>
  );
}

function StoryInspector({
  map,
  selection,
  busy,
  onPickChapter,
  onPickEdge,
  onRequestRestart,
}: {
  map: StoryMapEvent;
  selection: Selection;
  busy?: boolean;
  onPickChapter: (id: string) => void;
  onPickEdge: (id: string) => void;
  onRequestRestart: (target: RestartTarget) => void;
}) {
  if (selection.kind === 'chapter') {
    const ch = map.chapters.find((c) => c.id === selection.chapterId);
    if (!ch) return null;
    const phase = phaseOf(map, ch.id);
    const outgoing = map.edges.filter((e) => e.from === ch.id);
    const incoming = map.edges.filter((e) => e.to === ch.id);
    const label = chapterShort(map, ch.id);

    return (
      <div className="story-inspector">
        <p className="story-inspector__kicker">
          第{ch.rank + 1}章 · {phaseLabel(phase)}
        </p>
        <h3 className="story-inspector__title">{ch.display_name}</h3>
        {incoming.length > 0 && (
          <div className="story-inspector__block">
            <p className="story-inspector__label">如何到达</p>
            <ul className="story-inspector__list">
              {incoming.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className="story-inspector__link"
                    onClick={() => onPickEdge(e.id)}
                  >
                    {e.label || '未命名分歧'}
                    <span>自 {chapterShort(map, e.from)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="story-inspector__block">
          <p className="story-inspector__label">
            {outgoing.length > 0 ? '由此出发' : '没有列出的分歧'}
          </p>
          {outgoing.length > 0 ? (
            <ul className="story-inspector__list">
              {outgoing.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className="story-inspector__link"
                    onClick={() => onPickEdge(e.id)}
                  >
                    {e.label || '未命名分歧'}
                    <span>
                      {e.to ? `至 ${chapterShort(map, e.to)}` : '同章置 flag'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="story-inspector__empty">可从此章新开一局重玩。</p>
          )}
        </div>
        <button
          type="button"
          className="oc-btn oc-btn-primary w-full"
          disabled={busy}
          onClick={() =>
            onRequestRestart({ kind: 'chapter', chapterId: ch.id, label })
          }
        >
          从此章新开
        </button>
      </div>
    );
  }

  const edge = map.edges.find((e) => e.id === selection.ruleId);
  if (!edge) return null;
  const toLabel = edge.to ? chapterShort(map, edge.to) : '（同章置 flag）';

  return (
    <div className="story-inspector">
      <p className="story-inspector__kicker">分歧</p>
      <h3 className="story-inspector__title">{edge.label || '未命名分歧'}</h3>
      <p className="story-inspector__meta">
        {chapterShort(map, edge.from)}
        <span aria-hidden> → </span>
        {toLabel}
      </p>
      {edge.set_flag_names.length > 0 && (
        <div className="story-inspector__block">
          <p className="story-inspector__label">会写入</p>
          <p className="story-inspector__flags">
            {edge.set_flag_names.join(' · ')}
          </p>
        </div>
      )}
      <div className="story-inspector__actions">
        <button
          type="button"
          className="oc-btn oc-btn-ghost"
          onClick={() => onPickChapter(edge.from)}
        >
          查看起点章
        </button>
        <button
          type="button"
          className="oc-btn oc-btn-primary"
          disabled={busy}
          onClick={() =>
            onRequestRestart({
              kind: 'edge',
              ruleId: edge.id,
              label: edge.label,
              toLabel,
            })
          }
        >
          沿此分歧新开
        </button>
      </div>
    </div>
  );
}

/** Esc：当前进度摘要；点开故事线 */
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
  const current = map ? currentChapter(map) : undefined;
  const chapterCount = map?.chapters.length ?? 0;

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
            <span className="story-entry__eyebrow">进度</span>
            <span className="story-entry__title block">
              {current
                ? `第${current.rank + 1}章：${current.display_name}`
                : '故事线'}
            </span>
          </span>
          <span className="story-entry__go">打开</span>
        </span>
        <span className="story-entry__lead">
          {map
            ? `${chapterCount} 章 · 查看分歧或从此处新开`
            : '打开后同步进度'}
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
  const [selection, setSelection] = useState<Selection | null>(
    map ? { kind: 'chapter', chapterId: map.current_chapter } : null,
  );

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!map) return;
    setSelection((prev) => {
      if (prev?.kind === 'chapter' && map.chapters.some((c) => c.id === prev.chapterId)) {
        return prev;
      }
      if (prev?.kind === 'edge' && map.edges.some((e) => e.id === prev.ruleId)) {
        return prev;
      }
      return { kind: 'chapter', chapterId: map.current_chapter };
    });
  }, [map]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (pending) {
        setPending(null);
        setSlotName('');
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, pending]);

  const onChapter = useCallback((chapterId: string) => {
    setSelection({ kind: 'chapter', chapterId });
  }, []);

  const onEdge = useCallback((ruleId: string) => {
    setSelection({ kind: 'edge', ruleId });
  }, []);

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

  const orderedChapters = map
    ? [...map.chapters].sort((a, b) => a.rank - b.rank)
    : [];

  return (
    <div
      className="story-modal-root"
      data-entered={entered ? 'true' : 'false'}
      role="dialog"
      aria-modal="true"
      aria-label="故事线"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="story-modal">
        <header className="story-modal__head">
          <div className="min-w-0">
            <h2 className="story-modal__title">故事线</h2>
            {map && (
              <p className="story-modal__badge">
                当前 {chapterShort(map, map.current_chapter)}
              </p>
            )}
          </div>
          <button
            type="button"
            className="story-modal__btn story-modal__btn--ghost"
            onClick={onClose}
          >
            关闭
          </button>
        </header>

        {map && (
          <nav className="story-strip" aria-label="章节">
            {orderedChapters.map((c) => {
              const phase = phaseOf(map, c.id);
              const selected =
                selection?.kind === 'chapter' && selection.chapterId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  className="story-strip__item"
                  data-phase={phase}
                  data-selected={selected ? 'true' : 'false'}
                  aria-current={phase === 'now' ? 'step' : undefined}
                  onClick={() => onChapter(c.id)}
                >
                  <span className="story-strip__rank">
                    {String(c.rank + 1).padStart(2, '0')}
                  </span>
                  <span className="story-strip__name">{c.display_name}</span>
                </button>
              );
            })}
          </nav>
        )}

        <div className="story-modal__body">
          <div className="story-modal__canvas story-modal__canvas--flow">
            {!map ? (
              <div
                className="flex h-full min-h-[280px] items-center justify-center text-sm"
                style={{ color: 'var(--ui-fg-muted)' }}
              >
                加载故事线…
              </div>
            ) : (
              <ReactFlowProvider>
                <StoryFlowCanvas
                  map={map}
                  busy={busy}
                  selection={selection}
                  onChapter={onChapter}
                  onEdge={onEdge}
                />
              </ReactFlowProvider>
            )}
          </div>
          {map && selection && (
            <aside className="story-modal__side">
              <StoryInspector
                map={map}
                selection={selection}
                busy={busy}
                onPickChapter={onChapter}
                onPickEdge={onEdge}
                onRequestRestart={setPending}
              />
            </aside>
          )}
        </div>
      </div>

      {pending && map && (
        <div
          className="absolute inset-0 z-[10] flex items-center justify-center p-4"
          style={{ background: 'var(--ui-overlay)' }}
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
            }}
            role="alertdialog"
            aria-labelledby="story-restart-title"
          >
            <h4 id="story-restart-title" className="text-base font-semibold">
              从该节点新开存档？
            </h4>
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
                className="oc-input mt-1.5"
                value={slotName}
                maxLength={64}
                autoFocus
                placeholder="例如：测结局甲"
                onChange={(e) => setSlotName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirm();
                }}
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="oc-btn oc-btn-ghost"
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
                className="oc-btn oc-btn-primary"
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
