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
  AutoPlayEndingOption,
} from '@ocraft/shared';
import { useAutoPlay } from '@/lib/autoplay/useAutoPlay';
import { AutoPlaySetupModal } from './AutoPlaySetupModal';
import { getLabPeerAgentsEnabled } from '@/lib/lab-settings';
import {
  SPEECH_BUBBLE_PLAYER_ID,
  setSpeechBubble,
} from '@/lib/speechBubbles';

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
  /** AP-3：世界 flags（可达结局） */
  storyFlags?: Record<string, string>;
  /** AP-3：章节 rank 表 */
  chapterRankMap?: Record<string, number>;
  /** 可选停章列表 */
  chapterOptions?: Array<{ id: string; label: string }>;
  endingOptions?: AutoPlayEndingOption[];
  packMeta?: {
    world_id?: string;
    version_dir?: string;
    display_name?: string;
    default_style_id?: string;
    playable_player_enabled?: boolean;
  };
  lastNewRun?: NewRunStartedEvent | null;
  suggestions: string[] | null;
  suggestionsLoading: boolean;
  suggestionsError: string | null;
  onClose: () => void;
  onSend: (
    message: string,
    opts?: { whisper?: boolean; autoPlay?: boolean; epilogue?: boolean },
  ) => boolean;
  onRequestAutoplayNext: (payload: {
    turnIndex: number;
    maxTurns: number;
    chapterSpeakCap?: number;
    priorSays: string[];
    sawTargetExchange: boolean;
    targetChapter?: string;
    targetExchange?: string;
    targetEnding?: string;
    styleId?: string;
    goalTitle?: string;
    accelerate?: boolean;
    epilogue?: boolean;
    epilogueMode?: 'a' | 'b' | 'c';
    nearbyNpcIds?: string[];
  }) => boolean;
  /** 导演 cast 用附近 NPC */
  nearbyNpcIds?: string[];
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
  /** AP-4：Esc/菜单请求打开自动演设置（消费后清） */
  pendingAutoPlaySetup?: boolean;
  onConsumePendingAutoPlaySetup?: () => void;
  /** AP-4：Esc/菜单请求打开对话记录 */
  pendingHistoryOpen?: boolean;
  onConsumePendingHistoryOpen?: () => void;
  /** 关聊天时迷你条 / 外部入口需要把聊天打开 */
  onEnsureChatOpen?: () => void;
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
  storyFlags,
  chapterRankMap,
  chapterOptions,
  endingOptions,
  packMeta,
  lastNewRun,
  suggestions,
  suggestionsLoading,
  suggestionsError,
  onClose,
  onSend,
  onRequestAutoplayNext,
  nearbyNpcIds,
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
  pendingAutoPlaySetup,
  onConsumePendingAutoPlaySetup,
  pendingHistoryOpen,
  onConsumePendingHistoryOpen,
  onEnsureChatOpen,
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
  const [autoPlaySetupOpen, setAutoPlaySetupOpen] = useState(false);
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
  const beatBubbleTimersRef = useRef<number[]>([]);
  const onExchangeSpeakRef = useRef(onExchangeSpeak);
  historyFullscreenRef.current = historyFullscreen;
  loadPanelOpenRef.current = loadPanelOpen;
  onExchangeSpeakRef.current = onExchangeSpeak;

  const pushSystemNote = useCallback((text: string) => {
    setHistory((prev) => [...prev, { role: 'system', text }]);
  }, []);

  const sendAutoLine = useCallback(
    (message: string, sendOpts?: { epilogue?: boolean }) => {
      if (!connected) return false;
      setHistory((prev) => [
        ...prev,
        { role: 'player', text: message, autoPlay: true },
      ]);
      setSpeechBubble({
        speakerId: SPEECH_BUBBLE_PLAYER_ID,
        text: message,
        ttlMs: 2800,
      });
      lastStreamRef.current = '';
      const ok = onSend(message, {
        autoPlay: true,
        epilogue: sendOpts?.epilogue === true ? true : undefined,
      });
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

  const applyBeatLines = useCallback(
    (lines: NonNullable<AutoplayNextEvent['lines']>) => {
      setHistory((prev) => [
        ...prev,
        ...lines.map((l) =>
          l.speaker_kind === 'player'
            ? {
                role: 'player' as const,
                text: l.text,
                autoPlay: true,
              }
            : {
                role: 'aside' as const,
                text: l.text,
                speakerName: l.speaker_name ?? l.speaker_id,
                speakerId: l.speaker_id,
                autoPlay: true,
              },
        ),
      ]);
      // AP-4b：历史一次落盘，头顶气泡按句错开（观察箱观感）
      for (const t of beatBubbleTimersRef.current) window.clearTimeout(t);
      beatBubbleTimersRef.current = [];
      lines.forEach((l, i) => {
        const speakerId =
          l.speaker_kind === 'player'
            ? SPEECH_BUBBLE_PLAYER_ID
            : l.speaker_id;
        const delay = i * 1300;
        const tid = window.setTimeout(() => {
          setSpeechBubble({
            speakerId,
            text: l.text,
            ttlMs: 1600,
          });
          if (l.speaker_kind === 'npc') {
            onExchangeSpeakRef.current?.(l.speaker_id);
            window.setTimeout(() => onExchangeSpeakRef.current?.(null), 900);
          }
        }, delay);
        beatBubbleTimersRef.current.push(tid);
      });
    },
    [],
  );

  const nearbyRef = useRef(nearbyNpcIds ?? []);
  nearbyRef.current = nearbyNpcIds ?? [];

  const autoPlayProgress =
    chapterId && chapterRankMap
      ? {
          chapterState: chapterId,
          flags: storyFlags ?? {},
          rankMap: chapterRankMap,
        }
      : null;

  const autoPlay = useAutoPlay({
    npcId,
    isBusy: isStreaming || listening,
    isStreaming,
    chapterId,
    lastExchangeId: lastExchange?.eventId ?? null,
    lastEndingId: lastEnding?.endingId ?? null,
    connected,
    packMeta: {
      ...packMeta,
      endings: endingOptions,
      chapters: (chapterOptions ?? []).map((c) => ({ id: c.id })),
    },
    progress: autoPlayProgress,
    onSendAuto: sendAutoLine,
    onApplyBeatLines: applyBeatLines,
    onRequestNext: onRequestAutoplayNext,
    getNearbyNpcIds: () => nearbyRef.current,
    subscribeNext: onSubscribeAutoplayNext,
    onNote: pushSystemNote,
  });

  const autoPlayRef = useRef(autoPlay);
  autoPlayRef.current = autoPlay;

  const inputLocked = isStreaming || listening || autoPlay.locksInput;

  const autoPlayBusy =
    autoPlay.ui.status === 'running' ||
    autoPlay.ui.status === 'paused' ||
    autoPlay.ui.intervening;

  /** AP-4：浏览记录/存档时暂停；关栏不自动 resume */
  const pauseForBrowse = useCallback(() => {
    const ap = autoPlayRef.current;
    if (ap.ui.status !== 'running' || ap.ui.intervening) return;
    ap.pause(
      '查看记录/存档 · 自动演已暂停，关闭后请点「继续」才会恢复',
    );
  }, []);

  const stopAutoPlayForWorldChange = useCallback((reason: string) => {
    const ap = autoPlayRef.current;
    if (
      ap.ui.status !== 'running' &&
      ap.ui.status !== 'paused' &&
      !ap.ui.intervening
    ) {
      return;
    }
    ap.stop(reason);
  }, []);

  // AP-4：切 NPC 须先停自动演
  const prevNpcForAutoPlayRef = useRef(npcId);
  useEffect(() => {
    if (prevNpcForAutoPlayRef.current === npcId) return;
    prevNpcForAutoPlayRef.current = npcId;
    stopAutoPlayForWorldChange('已切换对话对象，自动演绎已停止');
  }, [npcId, stopAutoPlayForWorldChange]);

  // AP-4：Esc/菜单 → 开自动演设置
  useEffect(() => {
    if (!pendingAutoPlaySetup) return;
    onEnsureChatOpen?.();
    setAutoPlaySetupOpen(true);
    onConsumePendingAutoPlaySetup?.();
  }, [
    pendingAutoPlaySetup,
    onEnsureChatOpen,
    onConsumePendingAutoPlaySetup,
  ]);

  // AP-4：Esc/菜单 → 开对话记录（并暂停）
  useEffect(() => {
    if (!pendingHistoryOpen) return;
    onEnsureChatOpen?.();
    pauseForBrowse();
    setHistoryFullscreen(true);
    onConsumePendingHistoryOpen?.();
  }, [
    pendingHistoryOpen,
    onEnsureChatOpen,
    pauseForBrowse,
    onConsumePendingHistoryOpen,
  ]);

  useEffect(() => {
    if (!open) {
      // 关聊天窗不停自动演（观察箱）；仅收起面板。stopOnClose 为 no-op。
      autoPlay.stopOnClose();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅随 open 开关
  }, [open, onClearSuggestions]);

  useEffect(() => {
    if (!loadedConversation) return;
    stopAutoPlayForWorldChange('已读档，自动演绎已停止');
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
    stopAutoPlayForWorldChange,
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
    stopAutoPlayForWorldChange('已新开局，自动演绎已停止');
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
  }, [lastNewRun, onClearLastNewRun, stopAutoPlayForWorldChange]);

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
        setSpeechBubble({
          speakerId: line.npcId,
          text: line.text,
          ttlMs: 2200,
        });
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
    setSpeechBubble({
      speakerId: aside.npcId,
      text: aside.text,
      ttlMs: 3200,
    });
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
    setSpeechBubble({
      speakerId: line.npcId,
      text: line.text,
      ttlMs: 3200,
    });
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
      for (const t of beatBubbleTimersRef.current) window.clearTimeout(t);
      beatBubbleTimersRef.current = [];
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

    setSpeechBubble({
      speakerId: npcId,
      text: streamText,
      ttlMs: isStreaming ? 12_000 : 2800,
    });

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
    setSpeechBubble({
      speakerId: SPEECH_BUBBLE_PLAYER_ID,
      text: msg,
      ttlMs: 2800,
    });
    const inEpilogue =
      autoPlayRef.current.ui.phase === 'epilogue' &&
      autoPlayRef.current.ui.intervening;
    const ok = onSend(msg, {
      ...(whisper ? { whisper: true } : {}),
      ...(inEpilogue ? { epilogue: true } : {}),
    });
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
    pauseForBrowse();
    setLoadPanelOpen(true);
    setArchivesLoading(true);
    onListArchives();
  }, [connected, onListArchives, pauseForBrowse]);

  const handleOpenHistory = useCallback(() => {
    pauseForBrowse();
    setHistoryFullscreen(true);
  }, [pauseForBrowse]);

  const handleLoad = useCallback(
    (filename: string, snapshotIndex: number) => {
      stopAutoPlayForWorldChange('即将读档，自动演绎已停止');
      const ok = onLoadArchive(filename, snapshotIndex);
      if (!ok) return;
      setLoadPanelOpen(false);
    },
    [onLoadArchive, stopAutoPlayForWorldChange],
  );

  const handleNewRunFromStart = useCallback(() => {
    stopAutoPlayForWorldChange('即将新开局，自动演绎已停止');
    onNewRunFromStart?.();
  }, [onNewRunFromStart, stopAutoPlayForWorldChange]);

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

  if (!open) {
    const showDock =
      autoPlay.ui.status === 'running' ||
      autoPlay.ui.status === 'paused' ||
      autoPlay.ui.status === 'done' ||
      autoPlay.ui.status === 'abort' ||
      autoPlaySetupOpen;

    return (
      <>
        <AutoPlaySetupModal
          open={autoPlaySetupOpen}
          npcName={npcName}
          chapters={
            chapterOptions ??
            Object.entries(chapterLabels ?? {}).map(([id, label]) => ({
              id,
              label,
            }))
          }
          endings={endingOptions ?? []}
          progress={autoPlayProgress}
          packDefaultStyleId={packMeta?.default_style_id}
          onClose={() => setAutoPlaySetupOpen(false)}
          onConfirm={(prefs) => {
            if (getLabPeerAgentsEnabled()) {
              pushSystemNote(
                '请先关闭设置页「实验室 · 平级多 Agent」，再开自动演绎（二者互斥）。',
              );
              return;
            }
            setAutoPlaySetupOpen(false);
            autoPlay.startWithPrefs(prefs);
          }}
        />
        {showDock && (
          <div className="absolute bottom-4 left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-4 pointer-events-auto">
            <div className="rounded-xl border border-slate-600 bg-slate-900/95 px-3 py-2 shadow-xl">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] text-amber-200/90">
                  {autoPlay.ui.intervening
                    ? `已接管 · ${autoPlay.ui.progressLabel}`
                    : autoPlay.ui.phase === 'epilogue' &&
                        (autoPlay.ui.status === 'running' ||
                          autoPlay.ui.status === 'paused')
                      ? `${autoPlay.ui.status === 'paused' ? '杀青暂停' : '杀青中'} ${autoPlay.ui.progressLabel}`
                      : autoPlay.ui.status === 'running'
                        ? `自动演绎中 ${autoPlay.ui.progressLabel}${autoPlay.ui.accelerate ? ' · 加速' : ''}`
                        : autoPlay.ui.status === 'paused'
                          ? `已暂停 ${autoPlay.ui.progressLabel}`
                          : autoPlay.ui.status === 'done'
                            ? autoPlay.ui.phase === 'epilogue'
                              ? '杀青已结束'
                              : '自动演绎已完成'
                            : autoPlay.ui.status === 'abort'
                              ? `已中断${autoPlay.ui.failReason ? ` · ${autoPlay.ui.failReason}` : ''}`
                              : '自动演绎设置'}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  {autoPlay.ui.status === 'running' &&
                    !autoPlay.ui.intervening && (
                      <button
                        type="button"
                        onClick={() => autoPlay.pause()}
                        className="rounded px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800"
                      >
                        暂停
                      </button>
                    )}
                  {autoPlay.ui.status === 'paused' &&
                    !autoPlay.ui.intervening && (
                      <button
                        type="button"
                        onClick={autoPlay.resume}
                        className="rounded px-2 py-0.5 text-[11px] text-sky-300 hover:bg-slate-800"
                      >
                        继续
                      </button>
                    )}
                  {autoPlay.ui.phase === 'epilogue' &&
                    (autoPlay.ui.status === 'running' ||
                      autoPlay.ui.status === 'paused') && (
                      <button
                        type="button"
                        onClick={autoPlay.endEpilogue}
                        className="rounded px-2 py-0.5 text-[11px] text-amber-100 hover:bg-amber-900/40"
                      >
                        结束杀青
                      </button>
                    )}
                  {autoPlayBusy && (
                    <button
                      type="button"
                      onClick={() => autoPlay.stop()}
                      className="rounded px-2 py-0.5 text-[11px] text-rose-300 hover:bg-slate-800"
                    >
                      停止
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onEnsureChatOpen?.()}
                    className="rounded px-2 py-0.5 text-[11px] text-slate-200 hover:bg-slate-800"
                  >
                    打开对话
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

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
        onNewRunFromStart={handleNewRunFromStart}
      />

      <AutoPlaySetupModal
        open={autoPlaySetupOpen}
        npcName={npcName}
        chapters={
          chapterOptions ??
          Object.entries(chapterLabels ?? {}).map(([id, label]) => ({
            id,
            label,
          }))
        }
        endings={endingOptions ?? []}
        progress={autoPlayProgress}
        packDefaultStyleId={packMeta?.default_style_id}
        onClose={() => setAutoPlaySetupOpen(false)}
        onConfirm={(prefs) => {
          if (getLabPeerAgentsEnabled()) {
            pushSystemNote(
              '请先关闭设置页「实验室 · 平级多 Agent」，再开自动演绎（二者互斥）。',
            );
            return;
          }
          setAutoPlaySetupOpen(false);
          autoPlay.startWithPrefs(prefs);
        }}
      />

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl px-4 pointer-events-auto">
        <div className="bg-slate-900/95 border border-slate-600 rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={handleOpenHistory}
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
            <div className="flex flex-col gap-1 px-4 py-1.5 border-b border-slate-700 bg-slate-950/60">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-amber-200/90 truncate">
                  {autoPlay.ui.intervening
                    ? `已接管 · ${autoPlay.ui.progressLabel}`
                    : autoPlay.ui.phase === 'epilogue' &&
                        (autoPlay.ui.status === 'running' ||
                          autoPlay.ui.status === 'paused')
                      ? `${autoPlay.ui.status === 'paused' ? '杀青暂停' : '杀青中'} ${autoPlay.ui.progressLabel}`
                      : autoPlay.ui.status === 'running'
                        ? `自动演绎 ${autoPlay.ui.progressLabel}${autoPlay.ui.accelerate ? ' · 加速' : ''}`
                        : autoPlay.ui.status === 'paused'
                          ? `已暂停 ${autoPlay.ui.progressLabel}`
                          : autoPlay.ui.status === 'done'
                            ? autoPlay.ui.phase === 'epilogue'
                              ? '杀青已结束'
                              : '自动演绎已完成'
                            : `已中断${autoPlay.ui.failReason ? ` · ${autoPlay.ui.failReason}` : ''}`}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {autoPlay.ui.status === 'running' && !autoPlay.ui.intervening && (
                    <button
                      type="button"
                      onClick={() => autoPlay.pause()}
                      className="text-[11px] px-2 py-0.5 rounded text-slate-300 hover:bg-slate-800"
                    >
                      暂停
                    </button>
                  )}
                  {autoPlay.ui.status === 'paused' &&
                    !autoPlay.ui.intervening &&
                    !autoPlay.ui.needsAcceleratePrompt && (
                      <button
                        type="button"
                        onClick={autoPlay.resume}
                        className="text-[11px] px-2 py-0.5 rounded text-sky-300 hover:bg-slate-800"
                      >
                        继续
                      </button>
                    )}
                  {(autoPlay.ui.status === 'running' ||
                    autoPlay.ui.status === 'paused') &&
                    !autoPlay.ui.intervening &&
                    autoPlay.ui.phase !== 'epilogue' && (
                      <button
                        type="button"
                        onClick={() =>
                          autoPlay.setAccelerate(!autoPlay.ui.accelerate)
                        }
                        className={`text-[11px] px-2 py-0.5 rounded hover:bg-slate-800 ${
                          autoPlay.ui.accelerate
                            ? 'text-amber-200'
                            : 'text-slate-300'
                        }`}
                        title="加速：尽快升章；终章则冲结局"
                      >
                        {autoPlay.ui.accelerate ? '加速中' : '加速'}
                      </button>
                    )}
                  {(autoPlay.ui.status === 'running' ||
                    autoPlay.ui.status === 'paused') &&
                    (autoPlay.ui.takeoverMode === 'allow' ||
                      autoPlay.ui.phase === 'epilogue') &&
                    !autoPlay.ui.intervening && (
                      <button
                        type="button"
                        onClick={autoPlay.takeover}
                        className="text-[11px] px-2 py-0.5 rounded text-rose-300 hover:bg-slate-800"
                      >
                        接管
                      </button>
                    )}
                  {autoPlay.ui.intervening && (
                    <button
                      type="button"
                      onClick={autoPlay.handBack}
                      className="text-[11px] px-2 py-0.5 rounded text-emerald-300 hover:bg-slate-800"
                    >
                      交回
                    </button>
                  )}
                  {autoPlay.ui.phase === 'epilogue' &&
                    (autoPlay.ui.status === 'running' ||
                      autoPlay.ui.status === 'paused') && (
                      <button
                        type="button"
                        onClick={autoPlay.endEpilogue}
                        className="text-[11px] px-2 py-0.5 rounded text-amber-100 hover:bg-amber-900/40"
                      >
                        结束杀青
                      </button>
                    )}
                  {(autoPlay.ui.status === 'running' ||
                    autoPlay.ui.status === 'paused') && (
                    <button
                      type="button"
                      onClick={() => autoPlay.stop()}
                      className="text-[11px] px-2 py-0.5 rounded text-slate-300 hover:bg-slate-800"
                    >
                      停止
                    </button>
                  )}
                  {(autoPlay.ui.status === 'done' ||
                    autoPlay.ui.status === 'abort') && (
                    <button
                      type="button"
                      onClick={autoPlay.dismiss}
                      className="text-[11px] px-2 py-0.5 rounded text-slate-400 hover:bg-slate-800"
                    >
                      收起
                    </button>
                  )}
                </div>
              </div>
              {autoPlay.ui.needsAcceleratePrompt &&
                autoPlay.ui.status === 'paused' &&
                !autoPlay.ui.intervening &&
                autoPlay.ui.phase !== 'epilogue' && (
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-amber-200/80">本章发言已达上限</span>
                    <button
                      type="button"
                      onClick={autoPlay.keepPace}
                      className="px-2 py-0.5 rounded border border-slate-600 text-slate-200 hover:bg-slate-800"
                    >
                      保持
                    </button>
                    <button
                      type="button"
                      onClick={() => autoPlay.setAccelerate(true)}
                      className="px-2 py-0.5 rounded border border-amber-600/50 text-amber-100 hover:bg-slate-800"
                    >
                      加速
                    </button>
                  </div>
                )}
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
            {!autoPlay.locksInput && !autoPlay.ui.intervening ? (
              <button
                type="button"
                onClick={() => {
                  if (getLabPeerAgentsEnabled()) {
                    pushSystemNote(
                      '请先关闭设置页「实验室 · 平级多 Agent」，再开自动演绎（二者互斥）。',
                    );
                    return;
                  }
                  setAutoPlaySetupOpen(true);
                }}
                disabled={!connected || isStreaming || listening}
                title="打开自动演绎设置"
                className="shrink-0 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed border border-amber-700/60 rounded-lg text-sm text-amber-200/90 transition-colors"
              >
                自动演绎
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
                    ? '自动演绎中…（可暂停/接管/加速）'
                    : autoPlay.ui.intervening
                      ? '已接管 · 可输入；点交回继续自动演'
                      : autoPlay.ui.status === 'paused'
                      ? '已暂停 · 点继续或停止'
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
