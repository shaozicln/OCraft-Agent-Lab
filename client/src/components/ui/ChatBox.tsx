'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatHistoryFullscreen } from './ChatHistoryFullscreen';
import { ChatLoadPanel } from './ChatLoadPanel';
import type { ChatMessage } from './chat-types';
import type {
  ConversationArchiveSummary,
  ConversationLoadedEvent,
  ConversationSavedEvent,
  NewRunStartedEvent,
  NpcAsideEvent,
  NpcExchangeEvent,
  EndingReachedEvent,
  LabPeerLineEvent,
  LabProgressEvent,
  SceneUtterance,
  AutoplayNextEvent,
} from '@ocraft/shared';
import { useAutoPlay } from '@/lib/autoplay/useAutoPlay';
import { getLabPeerAgentsEnabled } from '@/lib/lab-settings';

interface ChatBoxProps {
  open: boolean;
  npcId: string;
  npcName: string;
  streamText: string;
  isStreaming: boolean;
  connected: boolean;
  lastSaved: ConversationSavedEvent | null;
  lastExchange?: NpcExchangeEvent | null;
  lastAside?: NpcAsideEvent | null;
  lastEnding?: EndingReachedEvent | null;
  lastLabPeerLine?: LabPeerLineEvent | null;
  labProgress?: LabProgressEvent['progress'] | null;
  archivesList: ConversationArchiveSummary[] | null;
  loadedConversation: ConversationLoadedEvent | null;
  saveError: string | null;
  loadError: string | null;
  chapterLabels?: Record<string, string>;
  /** 当前章节展示名（display_name） */
  chapterDisplayName?: string;
  /** 当前章节 id（自动演目标核对） */
  chapterId?: string;
  lastNewRun?: NewRunStartedEvent | null;
  suggestions: string[] | null;
  suggestionsLoading: boolean;
  suggestionsError: string | null;
  onClose: () => void;
  onSend: (
    message: string,
    opts?: { whisper?: boolean; autoPlay?: boolean },
  ) => boolean;
  onRequestAutoplayNext: (payload: {
    turnIndex: number;
    maxTurns: number;
    priorSays: string[];
    sawTargetExchange: boolean;
    targetChapter?: string;
    targetExchange?: string;
  }) => boolean;
  onSubscribeAutoplayNext: (
    handler: (ev: AutoplayNextEvent) => void,
  ) => () => void;
  onRequestSuggestions: () => boolean;
  onClearSuggestions: () => void;
  onSave: () => boolean;
  onListArchives: () => boolean;
  onLoadArchive: (filename: string, snapshotIndex: number) => boolean;
  onRenameArchive?: (filename: string, displayName: string) => boolean;
  onNewRunFromStart?: () => boolean;
  onClearLoadedConversation: () => void;
  onClearLastSaved: () => void;
  onClearLastNewRun?: () => void;
  onClearLastExchange?: () => void;
  onClearLastAside?: () => void;
  onClearLastEnding?: () => void;
  onClearLastLabPeerLine?: () => void;
  onClearLabProgress?: () => void;
  /** 旁听逐句时：当前开口的 NPC；结束传 null（驱动 3D talk） */
  onExchangeSpeak?: (npcId: string | null) => void;
}

function labStopReasonLabel(reason?: string): string {
  switch (reason) {
    case 'complete':
      return '本轮完成';
    case 'budget_round':
      return '本轮额度用尽';
    case 'budget_session':
      return '本局额度用尽';
    case 'no_candidates':
      return '无旁听候选';
    case 'whisper':
      return '悄悄话跳过';
    case 'disabled':
      return '已关闭';
    default:
      return reason ?? '';
  }
}

function sceneLogToChatMessages(log: SceneUtterance[]): ChatMessage[] {
  return log.map((u) => {
    const whisper = u.meta?.whisper === true;
    switch (u.kind) {
      case 'player_to_npc':
        return {
          role: 'player' as const,
          text: u.text,
          speakerId: u.speaker_id,
          speakerName: u.speaker_name,
          whisper,
        };
      case 'npc_to_player':
        if (u.meta?.aside) {
          return {
            role: 'aside' as const,
            text: u.text,
            speakerId: u.speaker_id,
            speakerName: u.speaker_name,
          };
        }
        return {
          role: 'npc' as const,
          text: u.text,
          speakerId: u.speaker_id,
          speakerName: u.speaker_name,
          whisper,
        };
      case 'npc_to_npc':
        return {
          role: 'exchange' as const,
          text: u.text,
          speakerId: u.speaker_id,
          speakerName: u.speaker_name,
        };
      case 'system':
      default:
        return {
          role: 'system' as const,
          text: u.text,
          speakerId: u.speaker_id,
          speakerName: u.speaker_name,
        };
    }
  });
}

function archivedToChatMessages(
  messages: ConversationLoadedEvent['messages'],
): ChatMessage[] {
  return messages.map((m: ConversationLoadedEvent['messages'][number]) => ({
    role: m.role === 'user' ? 'player' : 'npc',
    text: m.content,
  }));
}

function loadedToChatMessages(loaded: ConversationLoadedEvent): ChatMessage[] {
  if (loaded.scene_log && loaded.scene_log.length > 0) {
    return sceneLogToChatMessages(loaded.scene_log);
  }
  return archivedToChatMessages(loaded.messages);
}

export function ChatBox({
  open,
  npcId,
  npcName,
  streamText,
  isStreaming,
  connected,
  lastSaved,
  lastExchange,
  lastAside,
  lastEnding,
  lastLabPeerLine,
  labProgress,
  archivesList,
  loadedConversation,
  saveError,
  loadError,
  chapterLabels,
  chapterDisplayName,
  chapterId,
  lastNewRun,
  suggestions,
  suggestionsLoading,
  suggestionsError,
  onClose,
  onSend,
  onRequestAutoplayNext,
  onSubscribeAutoplayNext,
  onRequestSuggestions,
  onClearSuggestions,
  onSave,
  onListArchives,
  onLoadArchive,
  onRenameArchive,
  onNewRunFromStart,
  onClearLoadedConversation,
  onClearLastSaved,
  onClearLastNewRun,
  onClearLastExchange,
  onClearLastAside,
  onClearLastEnding,
  onClearLastLabPeerLine,
  onClearLabProgress,
  onExchangeSpeak,
}: ChatBoxProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [historyFullscreen, setHistoryFullscreen] = useState(false);
  const [loadPanelOpen, setLoadPanelOpen] = useState(false);
  const [archivesLoading, setArchivesLoading] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  /** 旁听逐句播放中：禁输入 */
  const [listening, setListening] = useState(false);
  const [labEnabled, setLabEnabled] = useState(false);
  /** 悄悄话开关（默认关；导演自动辨明为后续） */
  const [whisperMode, setWhisperMode] = useState(false);
  /** 当前活跃存档槽（高亮 / 顶栏） */
  const [activeSlotFilename, setActiveSlotFilename] = useState<string | null>(
    null,
  );
  const [activeSlotTitle, setActiveSlotTitle] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastStreamRef = useRef('');
  const streamNpcIdRef = useRef(npcId);
  /** 本轮流式回复是否对应悄悄话 */
  const pendingWhisperRef = useRef(false);
  const historyFullscreenRef = useRef(historyFullscreen);
  const loadPanelOpenRef = useRef(loadPanelOpen);
  historyFullscreenRef.current = historyFullscreen;
  loadPanelOpenRef.current = loadPanelOpen;

  const pushSystemNote = useCallback((text: string) => {
    setHistory((prev) => [...prev, { role: 'system', text }]);
  }, []);

  const sendAutoLine = useCallback(
    (message: string) => {
      if (!connected) return false;
      setHistory((prev) => [
        ...prev,
        { role: 'player', text: message, autoPlay: true },
      ]);
      lastStreamRef.current = '';
      const ok = onSend(message, { autoPlay: true });
      if (!ok) {
        setHistory((prev) => [
          ...prev,
          { role: 'system', text: '自动演绎发送失败' },
        ]);
      }
      return ok;
    },
    [connected, onSend],
  );

  const autoPlay = useAutoPlay({
    npcId,
    isBusy: isStreaming || listening,
    isStreaming,
    chapterId,
    lastExchangeId: lastExchange?.eventId ?? null,
    connected,
    onSendAuto: sendAutoLine,
    onRequestNext: onRequestAutoplayNext,
    subscribeNext: onSubscribeAutoplayNext,
    onNote: pushSystemNote,
  });

  const inputLocked = isStreaming || listening || autoPlay.locksInput;

  useEffect(() => {
    if (!open) {
      // 关闭聊天窗不清空整场流（Q1=B）；仅收起面板
      setInput('');
      setHistoryFullscreen(false);
      setLoadPanelOpen(false);
      setSuggestionsOpen(false);
      onClearSuggestions();
      lastStreamRef.current = '';
      return;
    }

    document.exitPointerLock();
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [open, onClearSuggestions]);

  useEffect(() => {
    if (!loadedConversation) return;
    const filename = loadedConversation.filename;
    setActiveSlotFilename(filename);
    const fromList = archivesList?.find((a) => a.filename === filename);
    const title =
      fromList?.display_name?.trim() || filename;
    setActiveSlotTitle(title);
    const chapterId = loadedConversation.npc_state.chapter_state;
    const chapterLabel = chapterId
      ? (chapterLabels?.[chapterId] ?? chapterId)
      : chapterDisplayName;
    const sceneMsgs = loadedToChatMessages(loadedConversation);
    setHistory([
      {
        role: 'system',
        text: chapterLabel
          ? `已回到：${title} · ${chapterLabel}`
          : `已回到：${title}`,
      },
      ...sceneMsgs,
    ]);
    lastStreamRef.current = '';
    onClearLoadedConversation();
  }, [
    loadedConversation,
    archivesList,
    chapterLabels,
    chapterDisplayName,
    onClearLoadedConversation,
  ]);

  useEffect(() => {
    if (!lastSaved) return;
    setActiveSlotFilename(lastSaved.filename);
    setActiveSlotTitle(lastSaved.filename);
    // 每轮都会自动存；仅升章/立旗时在聊天里提示（普通回合 world_changed=false）
    if (lastSaved.world_changed === false) {
      onClearLastSaved();
      return;
    }
    const savedChapterId = lastSaved.chapter_state;
    const savedChapterLabel = savedChapterId
      ? (chapterLabels?.[savedChapterId] ?? savedChapterId)
      : chapterDisplayName;
    setHistory((prev) => [
      ...prev,
      {
        role: 'system',
        text: savedChapterLabel
          ? `进度已自动保存 · 章节 ${savedChapterLabel}`
          : `进度已自动保存`,
      },
    ]);
    onClearLastSaved();
  }, [lastSaved, chapterLabels, chapterDisplayName, onClearLastSaved]);

  useEffect(() => {
    if (!lastNewRun) return;
    const title = lastNewRun.display_name || lastNewRun.filename;
    setActiveSlotFilename(lastNewRun.filename);
    setActiveSlotTitle(title);
    setHistory([
      {
        role: 'system',
        text: `已新开存档槽「${title}」，旧槽仍在列表中；从当前节点开始。`,
      },
    ]);
    lastStreamRef.current = '';
    onClearLastNewRun?.();
  }, [lastNewRun, onClearLastNewRun]);

  // 列表刷新后补全当前槽显示名
  useEffect(() => {
    if (!activeSlotFilename || !archivesList) return;
    const arch = archivesList.find((a) => a.filename === activeSlotFilename);
    if (arch) {
      setActiveSlotTitle(arch.display_name?.trim() || arch.filename);
    }
  }, [archivesList, activeSlotFilename]);

  useEffect(() => {
    if (!lastExchange) return;
    const event = lastExchange;
    let cancelled = false;

    setListening(true);
    setSuggestionsOpen(false);

    const delay = (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
      });

    void (async () => {
      for (let i = 0; i < event.lines.length; i++) {
        if (cancelled) return;
        const wait =
          i === 0 ? 350 : 400 + Math.floor(Math.random() * 301);
        await delay(wait);
        if (cancelled) return;
        const line = event.lines[i]!;
        onExchangeSpeak?.(line.npcId);
        setHistory((prev) => {
          const next = [...prev];
          if (i === 0) {
            next.push({ role: 'system', text: '……旁边有人在说话' });
          }
          next.push({
            role: 'exchange' as const,
            text: line.text,
            speakerName: line.name,
            speakerId: line.npcId,
          });
          return next;
        });
      }
      if (cancelled) return;
      await delay(450);
      if (cancelled) return;
      setListening(false);
      onExchangeSpeak?.(null);
      onClearLastExchange?.();
    })();

    return () => {
      cancelled = true;
      setListening(false);
      onExchangeSpeak?.(null);
    };
  }, [lastExchange, onClearLastExchange, onExchangeSpeak]);

  useEffect(() => {
    if (!lastAside) return;
    const aside = lastAside;
    onClearLastAside?.();
    onExchangeSpeak?.(aside.npcId);
    setHistory((prev) => [
      ...prev,
      {
        role: 'aside' as const,
        text: aside.text,
        speakerName: aside.name,
        speakerId: aside.npcId,
      },
    ]);
    const t = window.setTimeout(() => onExchangeSpeak?.(null), 900);
    return () => window.clearTimeout(t);
  }, [lastAside, onClearLastAside, onExchangeSpeak]);

  useEffect(() => {
    if (!lastLabPeerLine) return;
    const line = lastLabPeerLine;
    onClearLastLabPeerLine?.();
    onExchangeSpeak?.(line.npcId);
    setHistory((prev) => [
      ...prev,
      {
        role: 'aside' as const,
        text: line.text,
        speakerName: line.name,
        speakerId: line.npcId,
      },
    ]);
    const t = window.setTimeout(() => onExchangeSpeak?.(null), 900);
    return () => window.clearTimeout(t);
  }, [lastLabPeerLine, onClearLastLabPeerLine, onExchangeSpeak]);

  useEffect(() => {
    if (!lastEnding) return;
    const ending = lastEnding;
    onClearLastEnding?.();
    const note = ending.notes?.trim()
      ? `结局达成：${ending.displayName} — ${ending.notes}`
      : `结局达成：${ending.displayName}`;
    setHistory((prev) => [...prev, { role: 'system', text: note }]);
  }, [lastEnding, onClearLastEnding]);

  useEffect(() => {
    if (!open) return;
    setLabEnabled(getLabPeerAgentsEnabled());
  }, [open]);

  useEffect(() => {
    if (!labProgress || labProgress.status !== 'done') return;
    // 本轮额度用尽很常见，只靠进度条；系统条只提示「本局顶 / 无候选」
    if (
      labProgress.stopReason !== 'budget_session' &&
      labProgress.stopReason !== 'no_candidates'
    ) {
      return;
    }
    const label = labStopReasonLabel(labProgress.stopReason);
    if (!label) return;
    setHistory((prev) => {
      const note = `实验室 · ${label}（本局 ${labProgress.sessionPeerLines}/${labProgress.sessionPeerLineCap}）`;
      const last = prev[prev.length - 1];
      if (last?.role === 'system' && last.text === note) return prev;
      return [...prev, { role: 'system', text: note }];
    });
  }, [labProgress]);

  useEffect(() => {
    return () => {
      onExchangeSpeak?.(null);
    };
  }, [onExchangeSpeak]);

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
    // 切人：按 npcId 吞掉旧流，绝不能覆盖上一 NPC 已落盘的气泡
    if (streamNpcIdRef.current !== npcId) {
      streamNpcIdRef.current = npcId;
      lastStreamRef.current = streamText;
      return;
    }
    if (streamText === lastStreamRef.current) return;
    lastStreamRef.current = streamText;
    if (!streamText) return;

    setHistory((prev) => {
      const last = prev[prev.length - 1];
      const sameSpeaker = last?.role === 'npc' && last.speakerId === npcId;
      const whisper = pendingWhisperRef.current || last?.whisper === true;
      if (sameSpeaker) {
        return [
          ...prev.slice(0, -1),
          {
            role: 'npc',
            text: streamText,
            speakerName: npcName,
            speakerId: npcId,
            whisper,
          },
        ];
      }
      if (!isStreaming) return prev;
      return [
        ...prev,
        {
          role: 'npc',
          text: streamText,
          speakerName: npcName,
          speakerId: npcId,
          whisper: pendingWhisperRef.current,
        },
      ];
    });
  }, [streamText, isStreaming, npcId, npcName]);

  useEffect(() => {
    if (!isStreaming) {
      pendingWhisperRef.current = false;
    }
  }, [isStreaming]);

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
    if (!msg || inputLocked) return;
    const whisper = whisperMode;

    if (!connected) {
      setHistory((prev) => [
        ...prev,
        { role: 'player', text: msg, whisper },
        { role: 'system', text: '发送失败：未连接服务器（请先启动 server:4000）' },
      ]);
      setInput('');
      return;
    }

    pendingWhisperRef.current = whisper;
    setHistory((prev) => [...prev, { role: 'player', text: msg, whisper }]);
    const ok = onSend(msg, whisper ? { whisper: true } : undefined);
    if (!ok) {
      pendingWhisperRef.current = false;
      setHistory((prev) => [
        ...prev,
        { role: 'system', text: '发送失败，请稍后重试' },
      ]);
    }
    setInput('');
    setSuggestionsOpen(false);
    lastStreamRef.current = '';
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [connected, input, inputLocked, onSend, whisperMode]);

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

  const handleViewSuggestions = useCallback(() => {
    if (!connected || inputLocked || suggestionsLoading) return;
    setSuggestionsOpen(true);
    const ok = onRequestSuggestions();
    if (!ok) {
      setHistory((prev) => [
        ...prev,
        { role: 'system', text: '获取建议失败：未连接服务器' },
      ]);
      setSuggestionsOpen(false);
    }
  }, [connected, inputLocked, suggestionsLoading, onRequestSuggestions]);

  const handlePickSuggestion = useCallback((text: string) => {
    setInput(text);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  if (!open) return null;

  return (
    <>
      <ChatHistoryFullscreen
        open={historyFullscreen}
        npcId={npcId}
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
        activeFilename={activeSlotFilename}
        chapterLabels={chapterLabels}
        onClose={() => setLoadPanelOpen(false)}
        onLoad={handleLoad}
        onRename={onRenameArchive}
        onNewRunFromStart={onNewRunFromStart}
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
                onClick={handleOpenLoad}
                aria-label="存档槽"
                title="整局存档：每轮对话自动写入当前槽；也可新开一局"
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
              <div className="min-w-0 ml-0.5">
                <span className="block text-sm font-medium text-white truncate">
                  场景 · 正在与 {npcName} 交谈
                  {labEnabled && (
                    <span className="ml-2 align-middle text-[10px] font-normal text-rose-300/90 border border-rose-400/40 rounded px-1 py-0.5">
                      实验
                    </span>
                  )}
                </span>
                {activeSlotTitle && (
                  <span className="block text-[10px] text-slate-500 truncate">
                    自动保存 · {activeSlotTitle}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xs px-2 py-1 shrink-0"
            >
              ESC 关闭
            </button>
          </div>

          {labEnabled && labProgress && (
            <div className="flex items-center justify-between gap-2 px-4 py-1.5 border-b border-slate-700 bg-slate-950/50">
              <span className="text-[11px] text-rose-200/90 truncate">
                {labProgress.status === 'running'
                  ? `平级 tick 第 ${labProgress.roundIndex} 轮 · ${labProgress.roundPeerLines}/${labProgress.roundPeerLineCap} · 本局 ${labProgress.sessionPeerLines}/${labProgress.sessionPeerLineCap}`
                  : labProgress.status === 'abort'
                    ? `实验室中断 · ${labStopReasonLabel(labProgress.stopReason)}`
                    : `实验室 · ${labStopReasonLabel(labProgress.stopReason) || labProgress.status} · 本局 ${labProgress.sessionPeerLines}/${labProgress.sessionPeerLineCap}`}
              </span>
              {labProgress.status === 'done' || labProgress.status === 'abort' ? (
                <button
                  type="button"
                  onClick={() => onClearLabProgress?.()}
                  className="text-[11px] px-2 py-0.5 rounded text-slate-400 hover:bg-slate-800 shrink-0"
                >
                  收起
                </button>
              ) : null}
            </div>
          )}

          {(autoPlay.ui.status === 'running' ||
            autoPlay.ui.status === 'paused' ||
            autoPlay.ui.status === 'done' ||
            autoPlay.ui.status === 'abort') && (
            <div className="flex items-center justify-between gap-2 px-4 py-1.5 border-b border-slate-700 bg-slate-950/60">
              <span className="text-[11px] text-amber-200/90 truncate">
                {autoPlay.ui.status === 'running'
                  ? `自动演 ${autoPlay.ui.progressLabel}`
                  : autoPlay.ui.status === 'paused'
                    ? `已暂停 ${autoPlay.ui.progressLabel}`
                    : autoPlay.ui.status === 'done'
                      ? '自动演已完成'
                      : `已中断${autoPlay.ui.failReason ? ` · ${autoPlay.ui.failReason}` : ''}`}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {autoPlay.ui.status === 'running' && (
                  <button
                    type="button"
                    onClick={autoPlay.pause}
                    className="text-[11px] px-2 py-0.5 rounded text-slate-300 hover:bg-slate-800"
                  >
                    暂停
                  </button>
                )}
                {autoPlay.ui.status === 'paused' && (
                  <button
                    type="button"
                    onClick={autoPlay.resume}
                    className="text-[11px] px-2 py-0.5 rounded text-sky-300 hover:bg-slate-800"
                  >
                    继续
                  </button>
                )}
                {(autoPlay.ui.status === 'running' ||
                  autoPlay.ui.status === 'paused') && (
                  <button
                    type="button"
                    onClick={autoPlay.takeover}
                    className="text-[11px] px-2 py-0.5 rounded text-rose-300 hover:bg-slate-800"
                  >
                    接管
                  </button>
                )}
              </div>
            </div>
          )}

          <div ref={scrollRef} className="h-40 overflow-y-auto px-4 py-3 space-y-2">
            {history.length === 0 && (
              <p className="text-slate-500 text-sm">开始对话吧</p>
            )}
            {!connected && (
              <p className="text-red-400 text-sm">未连接服务器，请先启动 server（4000）</p>
            )}
            {history.map((item, i) => (
              <div
                key={i}
                className={`text-sm ${
                  item.role === 'player'
                    ? 'text-sky-300 text-right'
                    : item.role === 'system'
                      ? 'text-amber-400 text-center'
                      : item.role === 'exchange'
                        ? 'text-violet-300/90 italic'
                        : item.role === 'aside'
                          ? 'text-slate-400/90 italic text-xs'
                          : 'text-slate-200'
                }`}
              >
                {item.role === 'player'
                  ? item.autoPlay
                    ? '（自动）你：'
                    : item.whisper
                      ? '悄悄话·你：'
                      : '你：'
                  : item.role === 'system'
                    ? ''
                    : item.role === 'exchange'
                      ? `旁听·${item.speakerName ?? 'NPC'}：`
                      : item.role === 'aside'
                        ? `插话·${item.speakerName ?? 'NPC'}：`
                        : item.whisper
                          ? `悄悄话·${item.speakerName ?? 'NPC'}：`
                          : `${item.speakerName ?? 'NPC'}：`}
                {item.text}
                {item.role === 'npc' &&
                  isStreaming &&
                  i === history.length - 1 &&
                  item.speakerId === npcId && (
                  <span className="inline-block w-1.5 h-4 ml-0.5 bg-slate-400 animate-pulse align-middle" />
                )}
              </div>
            ))}
          </div>

          {suggestionsOpen && (
            <div className="px-4 py-2 border-t border-slate-700 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-400">剧情建议（点击填入）</span>
                <button
                  type="button"
                  onClick={() => {
                    setSuggestionsOpen(false);
                    onClearSuggestions();
                  }}
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  收起
                </button>
              </div>
              {suggestionsLoading && (
                <p className="text-xs text-slate-500">正在根据剧情生成建议…</p>
              )}
              {!suggestionsLoading && suggestionsError && (
                <p className="text-xs text-amber-400">{suggestionsError}</p>
              )}
              {!suggestionsLoading &&
                !suggestionsError &&
                suggestions &&
                suggestions.length === 0 && (
                  <p className="text-xs text-slate-500">暂无可用建议</p>
                )}
              {!suggestionsLoading && suggestions && suggestions.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {suggestions.map((s, i) => (
                    <button
                      key={`${i}-${s.slice(0, 12)}`}
                      type="button"
                      onClick={() => handlePickSuggestion(s)}
                      className="text-left text-sm text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {!suggestionsLoading && suggestions && suggestions.length > 0 && (
                <button
                  type="button"
                  onClick={handleViewSuggestions}
                  disabled={!connected || inputLocked}
                  className="text-xs text-sky-400 hover:text-sky-300 disabled:text-slate-600"
                >
                  换一批
                </button>
              )}
            </div>
          )}

          <form
            className="flex gap-2 px-4 py-3 border-t border-slate-700"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
          >
            <button
              type="button"
              onClick={handleViewSuggestions}
              disabled={!connected || inputLocked || suggestionsLoading}
              title="根据当前剧情生成可选回复"
              className="shrink-0 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed border border-slate-600 rounded-lg text-sm text-slate-200 transition-colors"
            >
              {suggestionsLoading ? '生成中…' : '查看建议'}
            </button>
            <button
              type="button"
              onClick={() => setWhisperMode((v) => !v)}
              disabled={inputLocked}
              title="悄悄话：仅当前对话 NPC 听见，同场其他人不会插话或旁听"
              aria-pressed={whisperMode}
              className={`shrink-0 px-3 py-2 border rounded-lg text-sm transition-colors disabled:cursor-not-allowed ${
                whisperMode
                  ? 'bg-fuchsia-700/80 hover:bg-fuchsia-600 border-fuchsia-500 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200 disabled:bg-slate-800 disabled:text-slate-600'
              }`}
            >
              悄悄话
            </button>
            {!autoPlay.locksInput ? (
              <button
                type="button"
                onClick={autoPlay.start}
                disabled={!connected || isStreaming || listening}
                title={autoPlay.goal.title}
                className="shrink-0 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed border border-amber-700/60 rounded-lg text-sm text-amber-200/90 transition-colors"
              >
                自动演
              </button>
            ) : null}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={inputLocked || !connected}
              placeholder={
                !connected
                  ? '等待连接服务器…'
                  : autoPlay.ui.status === 'running'
                    ? '自动演绎中…（可暂停/接管）'
                    : autoPlay.ui.status === 'paused'
                      ? '已暂停 · 点继续或接管'
                      : listening
                        ? '…正在旁听'
                        : isStreaming
                          ? '对方正在说话…'
                          : whisperMode
                            ? '悄悄话（仅对方听见）…'
                            : '输入对话…'
              }
              autoComplete="off"
              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={inputLocked || !input.trim()}
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
