'use client';

import type { ConversationArchiveSummary } from '@ocraft/shared';
import { useEffect, useRef, useState } from 'react';

interface ChatLoadPanelProps {
  open: boolean;
  archives: ConversationArchiveSummary[] | null;
  loading: boolean;
  error: string | null;
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

export function ChatLoadPanel({
  open,
  archives,
  loading,
  error,
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

  if (!open) return null;

  const labelOf = (chapterId: string) =>
    chapterLabels[chapterId] ?? chapterId;

  const titleOf = (archive: ConversationArchiveSummary) =>
    archive.display_name?.trim() || archive.filename;

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-end justify-center px-4 pb-48">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="关闭读档面板"
        onClick={onClose}
      />
      <div className="relative flex max-h-72 w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-600 bg-slate-900 shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-700 px-4 py-2">
          <span className="text-sm font-medium text-white">读档</span>
          <div className="flex items-center gap-2">
            {onNewRunFromStart && (
              <button
                type="button"
                className="rounded px-2 py-1 text-xs text-amber-300 hover:bg-slate-800"
                onClick={() => {
                  if (
                    window.confirm(
                      '新建独立存档槽并从第一章开始？当前进度会留在旧槽，本局将重置。',
                    )
                  ) {
                    onNewRunFromStart();
                    onClose();
                  }
                }}
              >
                新开一局
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-2 py-1 text-xs text-slate-400 hover:text-white"
            >
              关闭
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-2 py-2">
          {loading && (
            <p className="py-4 text-center text-sm text-slate-400">
              加载存档列表…
            </p>
          )}
          {error && (
            <p className="py-2 text-center text-sm text-red-400">{error}</p>
          )}
          {!loading && !error && archives?.length === 0 && (
            <p className="py-4 text-center text-sm text-slate-500">暂无存档</p>
          )}
          {archives?.map((archive) => (
            <div
              key={archive.filename}
              className="overflow-hidden rounded-lg border border-slate-700 bg-slate-800/80"
            >
              <div
                className="cursor-context-menu border-b border-slate-700 px-3 py-1.5 text-xs text-slate-300"
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
                <span className="font-medium text-white">
                  {titleOf(archive)}
                </span>
                {archive.display_name ? (
                  <span className="ml-2 text-slate-500">{archive.filename}</span>
                ) : null}
                <span className="ml-2 text-slate-500">
                  · {formatTime(archive.session_started_at)}
                </span>
              </div>
              <ul className="divide-y divide-slate-700/80">
                {archive.snapshots.map((snap) => (
                  <li key={`${archive.filename}-${snap.index}`}>
                    <button
                      type="button"
                      onClick={() => onLoad(archive.filename, snap.index)}
                      className="w-full px-3 py-2 text-left transition-colors hover:bg-slate-700/60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-white">
                          快照 #{snap.index + 1}
                        </span>
                        <span className="shrink-0 text-xs text-slate-400">
                          {formatTime(snap.saved_at)}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {snap.message_count} 条对话 · 好感{' '}
                        {snap.npc_state.affinity} · 疲惫{' '}
                        {snap.npc_state.fatigue} ·{' '}
                        {labelOf(snap.npc_state.chapter_state)}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {menu && (
        <div
          ref={menuRef}
          className="fixed z-[70] min-w-[8rem] rounded-lg border border-slate-600 bg-slate-800 py-1 shadow-xl"
          style={{ left: menu.x, top: menu.y }}
        >
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-xs text-white hover:bg-slate-700"
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
          <div className="w-full max-w-sm rounded-xl border border-slate-600 bg-slate-900 p-4">
            <h4 className="text-sm font-medium text-white">重命名存档</h4>
            <p className="mt-1 text-xs text-slate-400">{renameFor}</p>
            <input
              className="mt-3 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none"
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
                className="px-3 py-1.5 text-xs text-slate-400"
                onClick={() => setRenameFor(null)}
              >
                取消
              </button>
              <button
                type="button"
                disabled={!renameValue.trim() || !onRename}
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs text-white disabled:opacity-40"
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
