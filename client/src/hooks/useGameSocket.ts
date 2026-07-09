'use client';

import type {
  ConversationArchiveSummary,
  ConversationArchivesListEvent,
  ConversationLoadedEvent,
  ConversationSavedEvent,
} from '@ocraft/shared';
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { NpcStateUpdate } from '@ocraft/shared';
import { DEFAULT_NPC_ID, GAME_SERVER_URL } from '@/config/game';
import { getOrCreatePlayerId } from '@/lib/player-id';

export function useGameSocket(npcId = DEFAULT_NPC_ID) {
  const socketRef = useRef<Socket | null>(null);
  const playerIdRef = useRef('');
  const [connected, setConnected] = useState(false);
  const [npcState, setNpcState] = useState<NpcStateUpdate | null>(null);
  const [streamText, setStreamText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastSaved, setLastSaved] = useState<ConversationSavedEvent | null>(null);
  const [archivesList, setArchivesList] = useState<ConversationArchiveSummary[] | null>(
    null,
  );
  const [loadedConversation, setLoadedConversation] =
    useState<ConversationLoadedEvent | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    playerIdRef.current = getOrCreatePlayerId();
    const socket = io(GAME_SERVER_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('request_npc_state', {
        playerId: playerIdRef.current,
        npcId,
      });
    });
    socket.on('disconnect', () => {
      setConnected(false);
      setIsStreaming(false);
    });

    socket.on('npc_state_update', (data: NpcStateUpdate) => {
      if (data.npcId === npcId) {
        setNpcState(data);
      }
    });

    socket.on('npc_stream', (data: { npcId: string; chunk: string; done?: boolean }) => {
      if (data.npcId !== npcId) return;
      if (data.done) {
        setIsStreaming(false);
        return;
      }
      setIsStreaming(true);
      setStreamText((prev) => prev + data.chunk);
    });

    socket.on('npc_error', () => {
      setIsStreaming(false);
    });

    socket.on('conversation_saved', (data: ConversationSavedEvent) => {
      if (data.npcId !== npcId) return;
      setLastSaved(data);
      setSaveError(null);
    });

    socket.on('conversation_archives_list', (data: ConversationArchivesListEvent) => {
      if (data.npcId !== npcId) return;
      setArchivesList(data.archives);
      setLoadError(null);
    });

    socket.on('conversation_loaded', (data: ConversationLoadedEvent) => {
      if (data.npcId !== npcId) return;
      setLoadedConversation(data);
      setLoadError(null);
      setStreamText('');
      setIsStreaming(false);
    });

    socket.on('exception', (err: { message?: string }) => {
      const msg = err?.message ?? '操作失败';
      if (msg.includes('存档') || msg.includes('对话')) {
        setSaveError(msg);
      } else {
        setLoadError(msg);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [npcId]);

  const withPlayerPayload = <T extends Record<string, unknown>>(payload: T) => ({
    playerId: playerIdRef.current,
    ...payload,
  });

  const requestNpcState = () => {
    socketRef.current?.emit(
      'request_npc_state',
      withPlayerPayload({ npcId }),
    );
  };

  const sendChat = (message: string): boolean => {
    if (!socketRef.current?.connected) {
      setIsStreaming(false);
      return false;
    }
    setStreamText('');
    setIsStreaming(true);
    socketRef.current.emit(
      'player_chat',
      withPlayerPayload({ npcId, message }),
    );
    return true;
  };

  const saveConversation = (): boolean => {
    if (!socketRef.current?.connected) return false;
    setSaveError(null);
    socketRef.current.emit(
      'save_conversation',
      withPlayerPayload({ npcId }),
    );
    return true;
  };

  const listArchives = (): boolean => {
    if (!socketRef.current?.connected) return false;
    setLoadError(null);
    setArchivesList(null);
    socketRef.current.emit(
      'list_conversation_archives',
      withPlayerPayload({ npcId }),
    );
    return true;
  };

  const loadArchive = (filename: string, snapshotIndex: number): boolean => {
    if (!socketRef.current?.connected) return false;
    setLoadError(null);
    socketRef.current.emit(
      'load_conversation_archive',
      withPlayerPayload({ npcId, filename, snapshotIndex }),
    );
    return true;
  };

  const clearLoadedConversation = () => setLoadedConversation(null);
  const clearLastSaved = () => setLastSaved(null);

  return {
    connected,
    npcState,
    streamText,
    isStreaming,
    lastSaved,
    archivesList,
    loadedConversation,
    saveError,
    loadError,
    requestNpcState,
    sendChat,
    saveConversation,
    listArchives,
    loadArchive,
    clearLoadedConversation,
    clearLastSaved,
  };
}
