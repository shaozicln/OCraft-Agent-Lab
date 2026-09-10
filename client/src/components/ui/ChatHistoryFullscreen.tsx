'use client';

import { useEffect, useRef } from 'react';
import type { ChatMessage } from './chat-types';

interface ChatHistoryFullscreenProps {
  open: boolean;
  npcId: string;
  npcName: string;
  history: ChatMessage[];
  isStreaming: boolean;
  onClose: () => void;
}

export function ChatHistoryFullscreen({
  open,
  npcId,
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
    <div className="fixed inset-0 z-50 flex flex-col bg-hud">
      <header className="flex shrink-0 items-center gap-3 border-b border-hud-line px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="返回对话"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-hud-fg transition-colors hover:bg-hud-elevated hover:text-hud-fg"
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
        <div className="min-w-0 flex flex-col">
          <h2 className="text-base font-medium text-hud-fg">整场对话记录</h2>
          <span className="text-xs text-hud-muted truncate">
            当前交互：{npcName}
          </span>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-2xl space-y-4">
          {history.length === 0 && (
            <p className="text-center text-hud-muted text-sm">暂无对话记录</p>
          )}
          {history.map((item, i) => (
            <div
              key={i}
              className={`text-sm leading-relaxed ${
                item.role === 'player'
                  ? 'text-right text-hud-accent'
                  : item.role === 'system'
                    ? 'text-center text-hud-warn'
                    : item.role === 'exchange'
                      ? 'text-left text-hud-aside'
                      : item.role === 'aside'
                        ? 'text-left text-hud-muted italic'
                        : 'text-left text-hud-fg'
              }`}
            >
              <span className="text-hud-muted text-xs">
                {item.role === 'player'
                  ? item.whisper
                    ? '悄悄话·你'
                    : '你'
                  : item.role === 'system'
                    ? '系统'
                    : item.role === 'exchange'
                      ? `旁听·${item.speakerName ?? 'NPC'}`
                      : item.role === 'aside'
                        ? `插话·${item.speakerName ?? 'NPC'}`
                        : item.whisper
                          ? `悄悄话·${item.speakerName ?? 'NPC'}`
                          : item.speakerName ?? 'NPC'}
              </span>
              <p className="mt-1 whitespace-pre-wrap">{item.text}</p>
              {item.role === 'npc' &&
                isStreaming &&
                i === history.length - 1 &&
                item.speakerId === npcId && (
                <span className="inline-block w-1.5 h-4 ml-0.5 bg-hud-muted animate-pulse align-middle" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
