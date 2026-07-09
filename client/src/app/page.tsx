'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthGate } from '@/components/ui/AuthGate';
import { GameCanvas } from '@/components/r3f/GameCanvas';
import { ChatBox } from '@/components/ui/ChatBox';
import { HUD } from '@/components/ui/HUD';
import { InteractionPrompt } from '@/components/ui/InteractionPrompt';
import { HumanoidAnimation } from '@/components/r3f/Humanoid';
import { DEFAULT_NPC_ID, INTERACTION_DISTANCE } from '@/config/game';
import { useGameSocket } from '@/hooks/useGameSocket';
import { useNpcConfig } from '@/hooks/useNpcConfig';
import * as THREE from 'three';

function GamePageInner({
  token,
  username,
  logout,
}: {
  token: string;
  username: string;
  logout: () => void;
}) {
  const { npc, loading, error } = useNpcConfig(DEFAULT_NPC_ID);
  const [nearNpc, setNearNpc] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [npcAnimation, setNpcAnimation] = useState<HumanoidAnimation>('sleeping');
  const prevStateRef = useRef({ affinity: 30, fatigue: 30 });
  const [deltas, setDeltas] = useState<{ affinity?: number; fatigue?: number }>({});

  const {
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
  } = useGameSocket(token, DEFAULT_NPC_ID);

  const movementEnabled = !chatOpen;
  const lookEnabled = !chatOpen;

  const handlePlayerMove = useCallback((_pos: THREE.Vector3, distance: number) => {
    const isNear = distance < INTERACTION_DISTANCE;
    setNearNpc((prev) => (prev === isNear ? prev : isNear));
  }, []);

  const openChat = useCallback(() => {
    document.exitPointerLock();
    setChatOpen(true);
    requestNpcState();
  }, [requestNpcState]);

  const closeChat = useCallback(() => {
    document.exitPointerLock();
    setChatOpen(false);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (chatOpen) return;
      if (e.code === 'KeyF' && nearNpc) {
        e.preventDefault();
        openChat();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nearNpc, chatOpen, openChat]);

  useEffect(() => {
    if (npc?.runtime) {
      prevStateRef.current = {
        affinity: npc.runtime.affinity,
        fatigue: npc.runtime.fatigue,
      };
      setNpcAnimation(npc.runtime.current_status as HumanoidAnimation);
    }
  }, [npc]);

  useEffect(() => {
    if (!npcState || !chatOpen) return;

    const affDelta = npcState.affinity - prevStateRef.current.affinity;
    const fatDelta = npcState.fatigue - prevStateRef.current.fatigue;
    if (affDelta !== 0 || fatDelta !== 0) {
      setDeltas({ affinity: affDelta || undefined, fatigue: fatDelta || undefined });
      const timer = setTimeout(() => setDeltas({}), 2000);
      prevStateRef.current = {
        affinity: npcState.affinity,
        fatigue: npcState.fatigue,
      };
      return () => clearTimeout(timer);
    }

    prevStateRef.current = {
      affinity: npcState.affinity,
      fatigue: npcState.fatigue,
    };
  }, [npcState, chatOpen]);

  useEffect(() => {
    if (npcState?.animation) {
      setNpcAnimation(npcState.animation as HumanoidAnimation);
    }
  }, [npcState?.animation]);

  if (loading) {
    return (
      <main className="flex w-screen h-screen items-center justify-center bg-white text-gray-500">
        加载 NPC 配置…
      </main>
    );
  }

  if (error || !npc) {
    return (
      <main className="flex w-screen h-screen items-center justify-center bg-white text-red-500">
        无法加载 NPC：{error ?? 'unknown'}（请确认 server 已启动）
      </main>
    );
  }

  const affinity = npcState?.affinity ?? npc.runtime.affinity;
  const fatigue = npcState?.fatigue ?? npc.runtime.fatigue;
  const maxFatigue = npcState?.maxFatigue ?? npc.max_fatigue;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-white">
      <GameCanvas
        npc={npc}
        npcAnimation={npcAnimation}
        onPlayerMove={handlePlayerMove}
        movementEnabled={movementEnabled}
        lookEnabled={lookEnabled}
        onPointerLockChange={setPointerLocked}
        uiOverlayActive={chatOpen}
      />

      <div className="absolute top-4 left-4 z-20 pointer-events-none space-y-1">
        <h1 className="text-gray-800 text-lg font-bold">OCraft-办公室篇</h1>
        <p className="text-gray-500 text-xs">
          WASD 移动 · 鼠标转视角 · 滚轮缩放 · Alt 呼出鼠标 · 靠近 {npc.name} 按 F
        </p>
        <p className={`text-xs ${connected ? 'text-emerald-600' : 'text-red-500'}`}>
          {connected ? '● 已连接服务器' : '○ 未连接服务器 (3010)'}
        </p>
        <p className="text-xs text-gray-400">当前账号：{username}</p>
      </div>

      <button
        type="button"
        onClick={logout}
        className="absolute top-4 right-4 z-20 rounded-lg border border-gray-200 bg-white/90 px-3 py-1.5 text-xs text-gray-600 shadow-sm hover:bg-gray-50"
      >
        退出登录
      </button>

      {!pointerLocked && !chatOpen && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
          <p className="text-gray-400/80 text-sm bg-white/70 px-4 py-2 rounded-full border border-gray-200">
            点击画面锁定鼠标 · 滚轮缩放视角
          </p>
        </div>
      )}

      <HUD
        visible={chatOpen}
        name={npcState?.name ?? npc.name}
        affinity={affinity}
        fatigue={fatigue}
        maxFatigue={maxFatigue}
        chapterState={npcState?.chapter_state ?? 'daily'}
        affinityDelta={deltas.affinity}
        fatigueDelta={deltas.fatigue}
      />

      <InteractionPrompt visible={nearNpc && !chatOpen} onInteract={openChat} />

      <ChatBox
        open={chatOpen}
        npcName={npc.name}
        streamText={streamText}
        isStreaming={isStreaming}
        connected={connected}
        lastSaved={lastSaved}
        archivesList={archivesList}
        loadedConversation={loadedConversation}
        saveError={saveError}
        loadError={loadError}
        onClose={closeChat}
        onSend={sendChat}
        onSave={saveConversation}
        onListArchives={listArchives}
        onLoadArchive={loadArchive}
        onClearLoadedConversation={clearLoadedConversation}
        onClearLastSaved={clearLastSaved}
      />
    </main>
  );
}

export default function GamePage() {
  return (
    <AuthGate>
      {({ token, username, logout }) => (
        <GamePageInner token={token} username={username} logout={logout} />
      )}
    </AuthGate>
  );
}
