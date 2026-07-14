'use client';

import type {
  ArchiveRenamedEvent,
  ChatSuggestionsEvent,
  ConversationArchiveSummary,
  ConversationArchivesListEvent,
  ConversationLoadedEvent,
  ConversationSavedEvent,
  NewRunStartedEvent,
  NpcExchangeEvent,
  NpcStateUpdate,
  StoryMapEvent,
} from '@ocraft/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { GAME_SERVER_URL } from '@/config/game';

export function useGameSocket(
  token: string,
  activeNpcId: string,
  opts?: {
    /** 用该 NPC 的章节/flags 做世界进度（多 NPC 出场） */
    progressNpcId?: string;
    /** 进场时一并拉取状态的 NPC 列表 */
    trackNpcIds?: string[];
  },
) {
  const progressNpcId = opts?.progressNpcId || activeNpcId;
  const trackNpcIds = opts?.trackNpcIds ?? (activeNpcId ? [activeNpcId] : []);
  const trackKey = trackNpcIds.slice().sort().join(',');

  const socketRef = useRef<Socket | null>(null);
  const activeNpcIdRef = useRef(activeNpcId);
  activeNpcIdRef.current = activeNpcId;

  const [connected, setConnected] = useState(false);
  const [npcStates, setNpcStates] = useState<Record<string, NpcStateUpdate>>(
    {},
  );
  const [streamText, setStreamText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastSaved, setLastSaved] = useState<ConversationSavedEvent | null>(null);
  const [lastExchange, setLastExchange] = useState<NpcExchangeEvent | null>(
    null,
  );
  const [archivesList, setArchivesList] = useState<
    ConversationArchiveSummary[] | null
  >(null);
  const [loadedConversation, setLoadedConversation] =
    useState<ConversationLoadedEvent | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [storyMap, setStoryMap] = useState<StoryMapEvent | null>(null);
  const [lastNewRun, setLastNewRun] = useState<NewRunStartedEvent | null>(null);

  useEffect(() => {
    if (!token || trackNpcIds.length === 0) return;

    const socket = io(GAME_SERVER_URL, {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      for (const id of trackNpcIds) {
        socket.emit('request_npc_state', { npcId: id });
      }
    });
    socket.on('disconnect', () => {
      setConnected(false);
      setIsStreaming(false);
    });

    socket.on('npc_state_update', (data: NpcStateUpdate) => {
      setNpcStates((prev) => ({ ...prev, [data.npcId]: data }));
    });

    socket.on('npc_stream', (data: { npcId: string; chunk: string; done?: boolean }) => {
      if (data.npcId !== activeNpcIdRef.current) return;
      if (data.done) {
        setIsStreaming(false);
        return;
      }
      setIsStreaming(true);
      setStreamText((prev) => prev + data.chunk);
    });

    socket.on('npc_exchange', (data: NpcExchangeEvent) => {
      if (data.chatNpcId !== activeNpcIdRef.current) return;
      setLastExchange(data);
    });

    socket.on('npc_error', (data: { npcId?: string }) => {
      if (data?.npcId && data.npcId !== activeNpcIdRef.current) return;
      setIsStreaming(false);
    });

    socket.on('chat_suggestions', (data: ChatSuggestionsEvent) => {
      if (data.npcId !== activeNpcIdRef.current) return;
      setSuggestions(data.suggestions ?? []);
      setSuggestionsLoading(false);
      setSuggestionsError(data.error ?? null);
    });

    socket.on('conversation_saved', (data: ConversationSavedEvent) => {
      if (data.npcId !== activeNpcIdRef.current) return;
      setLastSaved(data);
      setSaveError(null);
    });

    socket.on('conversation_archives_list', (data: ConversationArchivesListEvent) => {
      if (data.npcId !== activeNpcIdRef.current) return;
      setArchivesList(data.archives);
      setLoadError(null);
    });

    socket.on('conversation_loaded', (data: ConversationLoadedEvent) => {
      if (data.npcId !== activeNpcIdRef.current) return;
      setLoadedConversation(data);
      setLoadError(null);
      setStreamText('');
      setIsStreaming(false);
      setSuggestions(null);
      setSuggestionsLoading(false);
      setSuggestionsError(null);
    });

    socket.on('story_map', (data: StoryMapEvent) => {
      setStoryMap(data);
    });

    socket.on('new_run_started', (data: NewRunStartedEvent) => {
      if (data.npcId !== activeNpcIdRef.current) return;
      setLastNewRun(data);
      setStreamText('');
      setIsStreaming(false);
      setLoadedConversation(null);
      setSuggestions(null);
      setNpcStates((prev) => ({
        ...prev,
        [data.npcId]: {
          ...(prev[data.npcId] ?? {
            npcId: data.npcId,
            affinity: 0,
            fatigue: 0,
          }),
          chapter_state: data.chapter_state,
          story_flags: data.story_flags,
        },
      }));
    });

    socket.on('archive_renamed', (data: ArchiveRenamedEvent) => {
      if (data.npcId !== activeNpcIdRef.current) return;
      setArchivesList((prev) =>
        prev
          ? prev.map((a) =>
              a.filename === data.filename
                ? { ...a, display_name: data.display_name }
                : a,
            )
          : prev,
      );
    });

    socket.on('exception', (err: { message?: string }) => {
      const msg = err?.message ?? '操作失败';
      if (
        msg.includes('存档') ||
        msg.includes('对话') ||
        msg.includes('重命名') ||
        msg.includes('新开')
      ) {
        setSaveError(msg);
      } else {
        setLoadError(msg);
      }
    });

    return () => {
      socket.disconnect();
    };
    // trackKey 变化才重建连接
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, trackKey]);

  const npcState = npcStates[activeNpcId] ?? null;
  const progressState = npcStates[progressNpcId] ?? null;

  const progressChapter = progressState?.chapter_state;
  const progressFlags = useMemo(
    () => progressState?.story_flags ?? {},
    [progressState?.story_flags],
  );

  const requestNpcState = useCallback((id?: string) => {
    const target = id || activeNpcIdRef.current;
    socketRef.current?.emit('request_npc_state', { npcId: target });
  }, []);

  const requestStoryMap = useCallback((): boolean => {
    if (!socketRef.current?.connected) return false;
    socketRef.current.emit('request_story_map', {
      npcId: activeNpcIdRef.current,
    });
    return true;
  }, []);

  const startNewRun = useCallback(
    (runOpts?: {
      chapterId?: string;
      viaRuleId?: string;
      displayName?: string;
    }): boolean => {
      if (!socketRef.current?.connected) return false;
      setSaveError(null);
      socketRef.current.emit('start_new_run', {
        npcId: activeNpcIdRef.current,
        ...runOpts,
      });
      return true;
    },
    [],
  );

  const renameArchive = useCallback(
    (filename: string, displayName: string): boolean => {
      if (!socketRef.current?.connected) return false;
      setSaveError(null);
      socketRef.current.emit('rename_archive', {
        npcId: activeNpcIdRef.current,
        filename,
        displayName,
      });
      return true;
    },
    [],
  );

  const sendChat = useCallback((message: string): boolean => {
    if (!socketRef.current?.connected) {
      setIsStreaming(false);
      return false;
    }
    setStreamText('');
    setIsStreaming(true);
    setSuggestions(null);
    setSuggestionsError(null);
    socketRef.current.emit('player_chat', {
      npcId: activeNpcIdRef.current,
      message,
    });
    return true;
  }, []);

  const requestSuggestions = useCallback((): boolean => {
    if (!socketRef.current?.connected) return false;
    setSuggestionsLoading(true);
    setSuggestionsError(null);
    setSuggestions(null);
    socketRef.current.emit('request_chat_suggestions', {
      npcId: activeNpcIdRef.current,
    });
    return true;
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions(null);
    setSuggestionsError(null);
    setSuggestionsLoading(false);
  }, []);

  const saveConversation = useCallback((): boolean => {
    if (!socketRef.current?.connected) return false;
    setSaveError(null);
    socketRef.current.emit('save_conversation', {
      npcId: activeNpcIdRef.current,
    });
    return true;
  }, []);

  const listArchives = useCallback((): boolean => {
    if (!socketRef.current?.connected) return false;
    setLoadError(null);
    setArchivesList(null);
    socketRef.current.emit('list_conversation_archives', {
      npcId: activeNpcIdRef.current,
    });
    return true;
  }, []);

  const loadArchive = useCallback(
    (filename: string, snapshotIndex: number): boolean => {
      if (!socketRef.current?.connected) return false;
      setLoadError(null);
      socketRef.current.emit('load_conversation_archive', {
        npcId: activeNpcIdRef.current,
        filename,
        snapshotIndex,
      });
      return true;
    },
    [],
  );

  const clearLoadedConversation = useCallback(
    () => setLoadedConversation(null),
    [],
  );
  const clearLastSaved = useCallback(() => setLastSaved(null), []);
  const clearLastNewRun = useCallback(() => setLastNewRun(null), []);
  const clearLastExchange = useCallback(() => setLastExchange(null), []);

  return {
    connected,
    npcState,
    npcStates,
    progressChapter,
    progressFlags,
    streamText,
    isStreaming,
    lastSaved,
    lastExchange,
    archivesList,
    loadedConversation,
    saveError,
    loadError,
    storyMap,
    lastNewRun,
    requestNpcState,
    requestStoryMap,
    startNewRun,
    renameArchive,
    sendChat,
    requestSuggestions,
    clearSuggestions,
    suggestions,
    suggestionsLoading,
    suggestionsError,
    saveConversation,
    listArchives,
    loadArchive,
    clearLoadedConversation,
    clearLastSaved,
    clearLastNewRun,
    clearLastExchange,
  };
}
