'use client';

import { useEffect, useRef } from 'react';
import type { ChatMessage } from './chat-types';

interface ChatHistoryFullscreenProps {
  open: boolean;
  npcName: string;
  history: ChatMessage[];
  isStreaming: boolean;
  onClose: () => void;
}

export function ChatHistoryFullscreen({
  open,
  npcName,
  history,
  isStreaming,
  onClose,
}: ChatHistoryFullscreenProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.code !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [open, history]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-800 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="返回对话"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-base font-medium text-white">与 {npcName} 的对话记录</h2>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-2xl space-y-4">
          {history.length === 0 && (
            <p className="text-center text-slate-500 text-sm">暂无对话记录</p>
          )}
          {history.map((item, i) => (
            <div
              key={i}
              className={`text-sm leading-relaxed ${
                item.role === 'player'
                  ? 'text-right text-sky-300'
                  : item.role === 'system'
                    ? 'text-center text-amber-400'
                    : 'text-left text-slate-200'
              }`}
            >
              <span className="text-slate-500 text-xs">
                {item.role === 'player' ? '你' : item.role === 'system' ? '系统' : npcName}
              </span>
              <p className="mt-1 whitespace-pre-wrap">{item.text}</p>
              {item.role === 'npc' && isStreaming && i === history.length - 1 && (
                <span className="inline-block w-1.5 h-4 ml-0.5 bg-slate-400 animate-pulse align-middle" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
