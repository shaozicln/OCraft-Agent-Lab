'use client';

import type { ConversationArchiveSummary } from '@ocraft/shared';
import { useEffect, useMemo, useRef, useState } from 'react';

interface ChatLoadPanelProps {
  open: boolean;
  archives: ConversationArchiveSummary[] | null;
  loading: boolean;
  error: string | null;
  /** 当前活跃存档槽 filename（高亮 +「继续」） */
  activeFilename?: string | null;
  /** chapterId → 展示名（来自当前 Pack） */
  chapterLabels?: Record<string, string>;
  onClose: () => void;
  onLoad: (filename: string, snapshotIndex: number) => void;
  onRename?: (filename: string, displayName: string) => boolean;
  onNewRunFromStart?: () => boolean;
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function latestSnap(archive: ConversationArchiveSummary) {
  if (!archive.snapshots.length) return null;
  return archive.snapshots[archive.snapshots.length - 1]!;
}

export function ChatLoadPanel({
  open,
  archives,
  loading,
  error,
  activeFilename = null,
  chapterLabels = {},
  onClose,
  onLoad,
  onRename,
  onNewRunFromStart,
}: ChatLoadPanelProps) {
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    filename: string;
  } | null>(null);
  const [renameFor, setRenameFor] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [expandedOlder, setExpandedOlder] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenu(null);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menu]);

  useEffect(() => {
    if (!open) {
      setExpandedOlder(null);
      setMenu(null);
      setRenameFor(null);
    }
  }, [open]);

  const sorted = useMemo(() => {
    if (!archives) return [];
    return [...archives].sort((a, b) => {
      const aActive = a.filename === activeFilename ? 1 : 0;
      const bActive = b.filename === activeFilename ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      const aT = latestSnap(a)?.saved_at ?? a.session_started_at;
      const bT = latestSnap(b)?.saved_at ?? b.session_started_at;
      return bT.localeCompare(aT);
    });
  }, [archives, activeFilename]);

  if (!open) return null;

  const labelOf = (chapterId: string) =>
    chapterLabels[chapterId] ?? chapterId;

  const titleOf = (archive: ConversationArchiveSummary) =>
    archive.display_name?.trim() || archive.filename;

  const handlePrimary = (archive: ConversationArchiveSummary) => {
    const snap = latestSnap(archive);
    if (!snap) return;
    const isCurrent = archive.filename === activeFilename;
    if (isCurrent) {
      // 已在当前槽：关闭面板即可「继续玩」
      onClose();
      return;
    }
    onLoad(archive.filename, snap.index);
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-end justify-center px-4 pb-48">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="关闭读档面板"
        onClick={onClose}
      />
      <div className="relative flex max-h-80 w-full max-w-md flex-col overflow-hidden rounded-xl border border-hud-line bg-hud shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-hud-line px-4 py-2">
          <div className="min-w-0">
            <span className="text-sm font-medium text-hud-fg">整局存档</span>
            <p className="text-[11px] text-hud-muted truncate">
              每轮对话自动写入当前槽 · 「继续」= 当前局，「读取」= 换一局
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 px-2 py-1 text-xs text-hud-muted hover:text-hud-fg"
          >
            关闭
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-2 py-2">
          {loading && (
            <p className="py-4 text-center text-sm text-hud-muted">
              加载存档列表…
            </p>
          )}
          {error && (
            <p className="py-2 text-center text-sm text-hud-danger">{error}</p>
          )}
          {!loading && !error && sorted.length === 0 && (
            <div className="space-y-3 px-2 py-6 text-center">
              <p className="text-sm text-hud-muted">还没有存档槽</p>
              <p className="text-xs text-hud-muted">
                开聊后会自动创建；也可以直接新开一局。
              </p>
              {onNewRunFromStart && (
                <button
                  type="button"
                  className="rounded-lg bg-hud-accent px-4 py-2 text-sm text-hud-on-accent hover:bg-hud-accent"
                  onClick={() => {
                    onNewRunFromStart();
                    onClose();
                  }}
                >
                  新开一局
                </button>
              )}
            </div>
          )}

          {sorted.map((archive) => {
            const isCurrent = archive.filename === activeFilename;
            const latest = latestSnap(archive);
            const older =
              archive.snapshots.length > 1
                ? archive.snapshots.slice(0, -1).reverse()
                : [];
            const chapterId = latest?.npc_state.chapter_state;
            const chapterLabel = chapterId ? labelOf(chapterId) : null;

            return (
              <div
                key={archive.filename}
                className={`overflow-hidden rounded-lg border ${
                  isCurrent
                    ? 'border-sky-500/70 bg-sky-950/40 ring-1 ring-sky-500/30'
                    : 'border-hud-line bg-hud-elevated/80'
                }`}
              >
                <div
                  className="cursor-context-menu px-3 py-2"
                  title="右键可重命名"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({
                      x: e.clientX,
                      y: e.clientY,
                      filename: archive.filename,
                    });
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-hud-fg">
                          {titleOf(archive)}
                        </span>
                        {isCurrent && (
                          <span className="shrink-0 rounded bg-hud-accent px-1.5 py-0.5 text-[10px] font-medium text-hud-on-accent">
                            当前
                          </span>
                        )}
                        <span className="shrink-0 rounded bg-emerald-950 px-1.5 py-0.5 text-[10px] text-hud-aside">
                          自动保存
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-hud-muted">
                        {latest
                          ? `${latest.message_count} 条 · ${formatTime(latest.saved_at)}`
                          : formatTime(archive.session_started_at)}
                        {chapterLabel ? ` · ${chapterLabel}` : ''}
                        {latest
                          ? ` · 好感 ${latest.npc_state.affinity}`
                          : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!latest}
                      onClick={() => handlePrimary(archive)}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                        isCurrent
                          ? 'bg-hud-accent text-hud-on-accent hover:bg-hud-accent'
                          : 'bg-hud-elevated text-hud-fg hover:bg-hud-line'
                      }`}
                    >
                      {isCurrent ? '继续' : '读取'}
                    </button>
                  </div>

                  {older.length > 0 && (
                    <div className="mt-2 border-t border-hud-line/80 pt-1.5">
                      <button
                        type="button"
                        className="text-[11px] text-hud-muted hover:text-hud-fg"
                        onClick={() =>
                          setExpandedOlder((prev) =>
                            prev === archive.filename ? null : archive.filename,
                          )
                        }
                      >
                        {expandedOlder === archive.filename
                          ? '收起更早快照'
                          : `更早快照（${older.length}）`}
                      </button>
                      {expandedOlder === archive.filename && (
                        <ul className="mt-1 space-y-1">
                          {older.map((snap) => (
                            <li key={`${archive.filename}-${snap.index}`}>
                              <button
                                type="button"
                                onClick={() =>
                                  onLoad(archive.filename, snap.index)
                                }
                                className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-[11px] text-hud-muted hover:bg-hud-line/50 hover:text-hud-fg"
                              >
                                <span>
                                  快照 #{snap.index + 1} · {snap.message_count}{' '}
                                  条 · {labelOf(snap.npc_state.chapter_state)}
                                </span>
                                <span className="shrink-0">
                                  {formatTime(snap.saved_at)} · 读取
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 新开一局：与读档列表隔离 */}
        {onNewRunFromStart && sorted.length > 0 && (
          <div className="shrink-0 border-t border-hud-line bg-hud/80 px-4 py-3">
            <p className="text-[11px] text-hud-muted">
              新开会创建<strong className="text-hud-muted">新槽</strong>
              ，旧槽仍留在上方列表，不会覆盖删除。
            </p>
            <button
              type="button"
              className="mt-2 w-full rounded-lg border border-hud-warn/50 bg-amber-950/40 px-3 py-2 text-xs text-amber-200 hover:bg-amber-900/50"
              onClick={() => {
                if (
                  window.confirm(
                    '新建一局存档槽并从起始章开始？\n\n旧槽仍会留在列表里，可随时读回；之后每轮对话写入这个新槽。',
                  )
                ) {
                  onNewRunFromStart();
                  onClose();
                }
              }}
            >
              新开一局（保留旧槽）
            </button>
          </div>
        )}
      </div>

      {menu && (
        <div
          ref={menuRef}
          className="fixed z-[70] min-w-[8rem] rounded-lg border border-hud-line bg-hud-elevated py-1 shadow-xl"
          style={{ left: menu.x, top: menu.y }}
        >
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-xs text-hud-fg hover:bg-hud-line"
            onClick={() => {
              const arch = archives?.find((a) => a.filename === menu.filename);
              setRenameFor(menu.filename);
              setRenameValue(arch?.display_name || '');
              setMenu(null);
            }}
          >
            重命名
          </button>
        </div>
      )}

      {renameFor && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-hud-line bg-hud p-4">
            <h4 className="text-sm font-medium text-hud-fg">重命名存档</h4>
            <p className="mt-1 text-xs text-hud-muted">{renameFor}</p>
            <input
              className="mt-3 w-full rounded-lg border border-hud-line bg-hud-elevated px-3 py-2 text-sm text-hud-fg outline-none"
              value={renameValue}
              maxLength={64}
              autoFocus
              placeholder="自定义名称"
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && renameValue.trim() && onRename) {
                  onRename(renameFor, renameValue.trim());
                  setRenameFor(null);
                }
              }}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1.5 text-xs text-hud-muted"
                onClick={() => setRenameFor(null)}
              >
                取消
              </button>
              <button
                type="button"
                disabled={!renameValue.trim() || !onRename}
                className="rounded-lg bg-hud-accent px-3 py-1.5 text-xs text-hud-on-accent disabled:opacity-40"
                onClick={() => {
                  if (!renameValue.trim() || !onRename) return;
                  onRename(renameFor, renameValue.trim());
                  setRenameFor(null);
                }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
