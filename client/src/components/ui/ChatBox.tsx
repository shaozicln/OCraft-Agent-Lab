'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatHistoryFullscreen } from './ChatHistoryFullscreen';
import { ChatLoadPanel } from './ChatLoadPanel';
import type { ChatMessage } from './chat-types';
import type {
  ConversationArchiveSummary,
  ConversationLoadedEvent,
  ConversationSavedEvent,
} from '@ocraft/shared';

interface ChatBoxProps {
  open: boolean;
  npcName: string;
  streamText: string;
  isStreaming: boolean;
  connected: boolean;
  lastSaved: ConversationSavedEvent | null;
  archivesList: ConversationArchiveSummary[] | null;
  loadedConversation: ConversationLoadedEvent | null;
  saveError: string | null;
  loadError: string | null;
  chapterLabels?: Record<string, string>;
  onClose: () => void;
  onSend: (message: string) => boolean;
  onSave: () => boolean;
  onListArchives: () => boolean;
  onLoadArchive: (filename: string, snapshotIndex: number) => boolean;
  onClearLoadedConversation: () => void;
  onClearLastSaved: () => void;
}

function archivedToChatMessages(
  messages: ConversationLoadedEvent['messages'],
): ChatMessage[] {
  return messages.map((m: ConversationLoadedEvent['messages'][number]) => ({
    role: m.role === 'user' ? 'player' : 'npc',
    text: m.content,
  }));
}

export function ChatBox({
  open,
  npcName,
  streamText,
  isStreaming,
  connected,
  lastSaved,
  archivesList,
  loadedConversation,
  saveError,
  loadError,
  chapterLabels,
  onClose,
  onSend,
  onSave,
  onListArchives,
  onLoadArchive,
  onClearLoadedConversation,
  onClearLastSaved,
}: ChatBoxProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [historyFullscreen, setHistoryFullscreen] = useState(false);
  const [loadPanelOpen, setLoadPanelOpen] = useState(false);
  const [archivesLoading, setArchivesLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastStreamRef = useRef('');
  const historyFullscreenRef = useRef(historyFullscreen);
  const loadPanelOpenRef = useRef(loadPanelOpen);
  historyFullscreenRef.current = historyFullscreen;
  loadPanelOpenRef.current = loadPanelOpen;

  useEffect(() => {
    if (!open) {
      setHistory([]);
      setInput('');
      setHistoryFullscreen(false);
      setLoadPanelOpen(false);
      lastStreamRef.current = '';
      return;
    }

    document.exitPointerLock();
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!loadedConversation) return;
    setHistory(archivedToChatMessages(loadedConversation.messages));
    lastStreamRef.current = '';
    onClearLoadedConversation();
  }, [loadedConversation, npcName, onClearLoadedConversation]);

  useEffect(() => {
    if (!lastSaved) return;
    setHistory((prev) => [
      ...prev,
      {
        role: 'system',
        text: `已存档：${lastSaved.filename} #${lastSaved.snapshotIndex + 1}`,
      },
    ]);
    onClearLastSaved();
  }, [lastSaved, onClearLastSaved]);

  useEffect(() => {
    if (!saveError) return;
    setHistory((prev) => [...prev, { role: 'system', text: saveError }]);
  }, [saveError]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.code !== 'Escape') return;

      e.preventDefault();
      e.stopImmediatePropagation();
      document.exitPointerLock();

      if (loadPanelOpenRef.current) {
        setLoadPanelOpen(false);
        return;
      }

      if (historyFullscreenRef.current) {
        setHistoryFullscreen(false);
        return;
      }

      onClose();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  useEffect(() => {
    if (streamText === lastStreamRef.current) return;
    lastStreamRef.current = streamText;
    if (!streamText) return;

    setHistory((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === 'npc' && isStreaming) {
        return [...prev.slice(0, -1), { role: 'npc', text: streamText }];
      }
      if (last?.role === 'npc') {
        return [...prev.slice(0, -1), { role: 'npc', text: streamText }];
      }
      return [...prev, { role: 'npc', text: streamText }];
    });
  }, [streamText, isStreaming]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [history, streamText]);

  useEffect(() => {
    if (archivesList !== null) {
      setArchivesLoading(false);
    }
  }, [archivesList]);

  const handleSend = useCallback(() => {
    const msg = input.trim();
    if (!msg || isStreaming) return;

    if (!connected) {
      setHistory((prev) => [
        ...prev,
        { role: 'player', text: msg },
        { role: 'system', text: '发送失败：未连接服务器（请先启动 server:3010）' },
      ]);
      setInput('');
      return;
    }

    setHistory((prev) => [...prev, { role: 'player', text: msg }]);
    const ok = onSend(msg);
    if (!ok) {
      setHistory((prev) => [
        ...prev,
        { role: 'system', text: '发送失败，请稍后重试' },
      ]);
    }
    setInput('');
    lastStreamRef.current = '';
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [connected, input, isStreaming, onSend]);

  const handleSave = useCallback(() => {
    if (!connected) {
      setHistory((prev) => [
        ...prev,
        { role: 'system', text: '存档失败：未连接服务器' },
      ]);
      return;
    }
    onSave();
  }, [connected, onSave]);

  const handleOpenLoad = useCallback(() => {
    if (!connected) {
      setHistory((prev) => [
        ...prev,
        { role: 'system', text: '读档失败：未连接服务器' },
      ]);
      return;
    }
    setLoadPanelOpen(true);
    setArchivesLoading(true);
    onListArchives();
  }, [connected, onListArchives]);

  const handleLoad = useCallback(
    (filename: string, snapshotIndex: number) => {
      const ok = onLoadArchive(filename, snapshotIndex);
      if (!ok) return;
      setLoadPanelOpen(false);
    },
    [onLoadArchive],
  );

  if (!open) return null;

  return (
    <>
      <ChatHistoryFullscreen
        open={historyFullscreen}
        npcName={npcName}
        history={history}
        isStreaming={isStreaming}
        onClose={() => setHistoryFullscreen(false)}
      />

      <ChatLoadPanel
        open={loadPanelOpen}
        archives={archivesList}
        loading={archivesLoading}
        error={loadError}
        chapterLabels={chapterLabels}
        onClose={() => setLoadPanelOpen(false)}
        onLoad={handleLoad}
      />

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl px-4 pointer-events-auto">
        <div className="bg-slate-900/95 border border-slate-600 rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={() => setHistoryFullscreen(true)}
                aria-label="查看对话记录"
                title="对话记录"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden
                >
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M12 7v5l4 2" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleSave}
                aria-label="存档"
                title="存档（同一会话可多次存入同一文件）"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-emerald-400"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden
                >
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleOpenLoad}
                aria-label="读档"
                title="读档 / 回档"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-sky-400"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
              <span className="text-sm font-medium text-white truncate ml-0.5">
                💬 {npcName}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xs px-2 py-1 shrink-0"
            >
              ESC 关闭
            </button>
          </div>

          <div ref={scrollRef} className="h-40 overflow-y-auto px-4 py-3 space-y-2">
            {history.length === 0 && (
              <p className="text-slate-500 text-sm">开始对话吧</p>
            )}
            {!connected && (
              <p className="text-red-400 text-sm">未连接服务器，请先启动 server（3010）</p>
            )}
            {history.map((item, i) => (
              <div
                key={i}
                className={`text-sm ${
                  item.role === 'player'
                    ? 'text-sky-300 text-right'
                    : item.role === 'system'
                      ? 'text-amber-400 text-center'
                      : 'text-slate-200'
                }`}
              >
                {item.role === 'player' ? '你：' : item.role === 'system' ? '' : `${npcName}：`}
                {item.text}
                {item.role === 'npc' && isStreaming && i === history.length - 1 && (
                  <span className="inline-block w-1.5 h-4 ml-0.5 bg-slate-400 animate-pulse align-middle" />
                )}
              </div>
            ))}
          </div>

          <form
            className="flex gap-2 px-4 py-3 border-t border-slate-700"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={connected ? '输入对话…' : '等待连接服务器…'}
              autoComplete="off"
              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-sm text-white transition-colors"
            >
              发送
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
