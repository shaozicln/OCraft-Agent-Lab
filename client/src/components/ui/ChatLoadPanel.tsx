'use client';

import type { ConversationArchiveSummary } from '@ocraft/shared';

interface ChatLoadPanelProps {
  open: boolean;
  archives: ConversationArchiveSummary[] | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onLoad: (filename: string, snapshotIndex: number) => void;
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

const CHAPTER_LABEL: Record<string, string> = {
  daily: '日常',
  uneasy: '异常',
  dream_reveal: '梦境',
};

export function ChatLoadPanel({
  open,
  archives,
  loading,
  error,
  onClose,
  onLoad,
}: ChatLoadPanelProps) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center pb-48 px-4 pointer-events-auto">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="关闭读档面板"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md max-h-64 overflow-hidden bg-slate-900 border border-slate-600 rounded-xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 shrink-0">
          <span className="text-sm font-medium text-white">读档</span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xs px-2 py-1"
          >
            关闭
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-2 py-2 space-y-2">
          {loading && (
            <p className="text-slate-400 text-sm text-center py-4">加载存档列表…</p>
          )}
          {error && (
            <p className="text-red-400 text-sm text-center py-2">{error}</p>
          )}
          {!loading && !error && archives?.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-4">暂无存档</p>
          )}
          {archives?.map((archive) => (
            <div
              key={archive.filename}
              className="rounded-lg border border-slate-700 bg-slate-800/80 overflow-hidden"
            >
              <div className="px-3 py-1.5 text-xs text-slate-400 border-b border-slate-700">
                {archive.filename} · 会话 {formatTime(archive.session_started_at)}
              </div>
              <ul className="divide-y divide-slate-700/80">
                {archive.snapshots.map((snap) => (
                  <li key={`${archive.filename}-${snap.index}`}>
                    <button
                      type="button"
                      onClick={() => onLoad(archive.filename, snap.index)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-700/60 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-white">
                          存档 #{snap.index + 1}
                        </span>
                        <span className="text-xs text-slate-400 shrink-0">
                          {formatTime(snap.saved_at)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {snap.message_count} 条对话 · 好感 {snap.npc_state.affinity} ·
                        疲惫 {snap.npc_state.fatigue} ·{' '}
                        {CHAPTER_LABEL[snap.npc_state.chapter_state] ??
                          snap.npc_state.chapter_state}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
