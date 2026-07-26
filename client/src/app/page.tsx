'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isNpcPresent } from '@ocraft/shared';
import { AuthGate } from '@/components/ui/AuthGate';
import { GameCanvas, type SceneNpc } from '@/components/r3f/GameCanvas';
import { type HumanoidAnimation } from '@/components/r3f/Humanoid';
import { ChapterTransition, type ChapterCue } from '@/components/ui/ChapterTransition';
import { ChatBox } from '@/components/ui/ChatBox';
import { EscMenu } from '@/components/ui/EscMenu';
import { HUD } from '@/components/ui/HUD';
import { InteractionPrompt } from '@/components/ui/InteractionPrompt';
import { useGameSocket } from '@/hooks/useGameSocket';
import { useNpcConfig } from '@/hooks/useNpcConfig';
import { usePackRuntime } from '@/hooks/usePackRuntime';
import type { NearbyNpc } from '@/components/r3f/Player';

/** 具名角色优先：衣服色 + 肤色，避免糖果粉蓝糊成一团 */
const NPC_COLOR_BY_ID: Record<string, { color: string; headColor: string }> = {
  npc_suolunsen: { color: '#2F4A5C', headColor: '#E4B892' }, // 墨蓝外套 · 暖肤
  npc_hilvi: { color: '#6E4E5C', headColor: '#EFD4C6' }, // 暮紫外套 · 浅肤
};

const NPC_PALETTE = [
  { color: '#2F4A5C', headColor: '#E4B892' },
  { color: '#6E4E5C', headColor: '#EFD4C6' },
  { color: '#3F5E4A', headColor: '#E6C4A8' },
  { color: '#5C4A3A', headColor: '#E8C9B0' },
  { color: '#4A4E6A', headColor: '#E2C2B0' },
] as const;

/** 按 npc_id 稳定取色，升章刷人后颜色不漂移 */
function paletteForNpc(npcId: string) {
  const named = NPC_COLOR_BY_ID[npcId];
  if (named) return named;
  let h = 0;
  for (let i = 0; i < npcId.length; i++) {
    h = (h * 31 + npcId.charCodeAt(i)) >>> 0;
  }
  return NPC_PALETTE[h % NPC_PALETTE.length];
}

function asAnim(v: string | undefined): HumanoidAnimation {
  if (
    v === 'idle' ||
    v === 'sleeping' ||
    v === 'talk' ||
    v === 'excited_talk'
  ) {
    return v;
  }
  return 'idle';
}

function GamePageInner({
  token,
  username,
  logout,
  updateSession,
}: {
  token: string;
  username: string;
  logout: () => void;
  updateSession: (session: import('@ocraft/shared').AuthSession) => void;
}) {
  const {
    runtime,
    loading: packLoading,
    error: packError,
  } = usePackRuntime(token);

  const defaultNpcId = runtime?.default_npc_id ?? '';
  const chapterLabels = runtime?.chapter_labels ?? {};
  const defaultChapter = runtime?.default_chapter ?? '';
  const allNpcIds = useMemo(
    () => runtime?.npcs.map((n) => n.npc_id) ?? [],
    [runtime?.npcs],
  );
  const rankMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of runtime?.chapters ?? []) m[c.id] = c.rank;
    return m;
  }, [runtime?.chapters]);

  const [activeNpcId, setActiveNpcId] = useState(defaultNpcId);
  const [nearbyNpcs, setNearbyNpcs] = useState<NearbyNpc[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pointerLocked, setPointerLocked] = useState(false);
  const prevStateRef = useRef({ affinity: 0, fatigue: 0 });
  const [deltas, setDeltas] = useState<{ affinity?: number; fatigue?: number }>(
    {},
  );
  const prevChapterRef = useRef<string | undefined>(undefined);
  const [chapterCue, setChapterCue] = useState<ChapterCue | null>(null);
  /** 旁听逐句：当前开口的 NPC → talk 动画 */
  const [exchangeSpeakNpcId, setExchangeSpeakNpcId] = useState<
    string | null
  >(null);
  /** 读档/新开/首次进度就绪：场景 NPC 瞬现对齐，不播进场 */
  const [presenceSnapToken, setPresenceSnapToken] = useState(0);
  const presenceHydratedRef = useRef(false);

  useEffect(() => {
    if (defaultNpcId) setActiveNpcId((id) => id || defaultNpcId);
  }, [defaultNpcId]);

  const { npc, error: npcError } = useNpcConfig(
    activeNpcId || defaultNpcId,
    token,
  );

  const {
    connected,
    npcState,
    npcStates,
    progressChapter,
    progressFlags,
    streamText,
    isStreaming,
    lastSaved,
    lastExchange,
    lastAside,
    lastEnding,
    archivesList,
    loadedConversation,
    lastNewRun,
    selectedNpcIds,
    saveError,
    loadError,
    requestNpcState,
    sendChat,
    requestSuggestions,
    requestAutoplayNext,
    subscribeAutoplayNext,
    clearSuggestions,
    suggestions,
    suggestionsLoading,
    suggestionsError,
    saveConversation,
    listArchives,
    loadArchive,
    renameArchive,
    startNewRun,
    requestStoryMap,
    storyMap,
    setRunNpcSelection,
    clearLoadedConversation,
    clearLastSaved,
    clearLastNewRun,
    clearLastExchange,
    clearLastAside,
    clearLastEnding,
  } = useGameSocket(token, activeNpcId || defaultNpcId, {
    progressNpcId: defaultNpcId,
    trackNpcIds: allNpcIds.length ? allNpcIds : [defaultNpcId],
  });

  const worldChapter = progressChapter ?? defaultChapter;
  const nearNpc = nearbyNpcs.length > 0;
  const primaryNearNpcId = nearbyNpcs[0]?.npcId ?? null;

  const eligibleNpcs = useMemo(() => {
    if (!runtime) return [];
    return runtime.npcs.filter((n) =>
      isNpcPresent({
        appear_from_chapter: n.appear_from_chapter,
        appear_require_flags: n.appear_require_flags,
        chapterState: worldChapter,
        flags: progressFlags,
        rankMap,
      }),
    );
  }, [runtime, worldChapter, progressFlags, rankMap]);

  /** 在已可出场里筛选；null 选用 = 全部已可出场 */
  const visibleNpcs = useMemo(() => {
    if (!selectedNpcIds) return eligibleNpcs;
    const allow = new Set(selectedNpcIds);
    return eligibleNpcs.filter((n) => allow.has(n.npc_id));
  }, [eligibleNpcs, selectedNpcIds]);

  const sceneNpcPicker = useMemo(() => {
    if (!runtime) return [];
    const eligibleIds = new Set(eligibleNpcs.map((n) => n.npc_id));
    return runtime.npcs.map((n) => ({
      npcId: n.npc_id,
      name: n.name,
      eligible: eligibleIds.has(n.npc_id),
    }));
  }, [runtime, eligibleNpcs]);

  const handleNpcSelectionChange = useCallback(
    (npcIds: string[] | null) => {
      setRunNpcSelection(npcIds);
    },
    [setRunNpcSelection],
  );

  // 当前焦点 NPC 被移出本局出场时，切到仍在场的第一人
  useEffect(() => {
    if (visibleNpcs.length === 0) return;
    if (visibleNpcs.some((n) => n.npc_id === activeNpcId)) return;
    setActiveNpcId(visibleNpcs[0]!.npc_id);
  }, [visibleNpcs, activeNpcId]);

  const sceneNpcs: SceneNpc[] = useMemo(
    () =>
      visibleNpcs.map((n) => {
        const palette = paletteForNpc(n.npc_id);
        const st = npcStates[n.npc_id];
        const baseAnim = asAnim(st?.animation ?? st?.current_status);
        return {
          npcId: n.npc_id,
          name: n.name,
          spawn: n.spawn_position,
          color: palette.color,
          headColor: palette.headColor,
          modelPath: n.model_path,
          animation:
            exchangeSpeakNpcId === n.npc_id ? 'excited_talk' : baseAnim,
        };
      }),
    [visibleNpcs, npcStates, exchangeSpeakNpcId],
  );

  // 首次进度 hydrate：开场已在场的人站桩
  useEffect(() => {
    if (!runtime || progressChapter == null) return;
    if (presenceHydratedRef.current) return;
    presenceHydratedRef.current = true;
    setPresenceSnapToken((t) => t + 1);
  }, [runtime, progressChapter]);

  // 读档：已该在场的人站桩，不重播进场
  useEffect(() => {
    if (!loadedConversation) return;
    setPresenceSnapToken((t) => t + 1);
  }, [loadedConversation]);

  // 新开一局：重置在场，不走离场演出
  useEffect(() => {
    if (!lastNewRun) return;
    setPresenceSnapToken((t) => t + 1);
  }, [lastNewRun]);

  const interactTargets = useMemo(
    () =>
      nearbyNpcs.map((n) => ({
        npcId: n.npcId,
        name:
          visibleNpcs.find((v) => v.npc_id === n.npcId)?.name ??
          npcStates[n.npcId]?.name ??
          n.npcId,
      })),
    [nearbyNpcs, visibleNpcs, npcStates],
  );

  const uiBlocking = chatOpen || menuOpen;
  const movementEnabled = !uiBlocking;
  const lookEnabled = !uiBlocking;

  const handlePlayerMove = useCallback((nearby: NearbyNpc[]) => {
    setNearbyNpcs((prev) => {
      if (
        prev.length === nearby.length &&
        prev.every((p, i) => p.npcId === nearby[i]?.npcId)
      ) {
        return prev;
      }
      return nearby;
    });
  }, []);

  const handleSendChat = useCallback(
    (message: string, opts?: { whisper?: boolean; autoPlay?: boolean }) => {
      // 同场短接话：交互圈内 + 当前场景已出场的其他人（spawn 相距常 > 交互距离）
      // 悄悄话不传 nearby（服务端也会跳过 aside/exchange）
      if (opts?.whisper) {
        return sendChat(message, {
          whisper: true,
          autoPlay: opts.autoPlay,
        });
      }
      const ids = [
        ...new Set([
          ...nearbyNpcs.map((n) => n.npcId),
          ...visibleNpcs.map((n) => n.npc_id),
        ]),
      ];
      return sendChat(message, {
        nearbyNpcIds: ids,
        autoPlay: opts?.autoPlay,
      });
    },
    [sendChat, nearbyNpcs, visibleNpcs],
  );

  const handleExchangeSpeak = useCallback((id: string | null) => {
    setExchangeSpeakNpcId(id);
  }, []);

  const openChat = useCallback(
    (npcId?: string) => {
      const target =
        npcId || primaryNearNpcId || activeNpcId || defaultNpcId;
      if (!target) return;
      setActiveNpcId(target);
      document.exitPointerLock();
      setMenuOpen(false);
      setChatOpen(true);
      requestNpcState(target);
    },
    [primaryNearNpcId, activeNpcId, defaultNpcId, requestNpcState],
  );

  const closeChat = useCallback(() => {
    document.exitPointerLock();
    setChatOpen(false);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const handleRequestStoryMap = useCallback(() => {
    requestStoryMap();
  }, [requestStoryMap]);

  const handleStartNewRun = useCallback(
    (opts: {
      chapterId?: string;
      viaRuleId?: string;
      displayName?: string;
    }) => {
      const ok = startNewRun(opts);
      if (ok) {
        setMenuOpen(false);
        setChatOpen(true);
      }
    },
    [startNewRun],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (chatOpen) return;

      if (e.code === 'Escape') {
        e.preventDefault();
        document.exitPointerLock();
        setMenuOpen((v) => !v);
        return;
      }

      if (menuOpen) return;

      if (e.code === 'KeyF' && nearNpc) {
        e.preventDefault();
        openChat();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nearNpc, chatOpen, menuOpen, openChat]);

  useEffect(() => {
    if (npc?.runtime) {
      prevStateRef.current = {
        affinity: npc.runtime.affinity,
        fatigue: npc.runtime.fatigue,
      };
    }
  }, [npc]);

  // 服务端章节变化 → 全屏过场（跳过首次同步；不用 defaultChapter 以免误触发）
  useEffect(() => {
    if (!progressChapter || !runtime) return;
    const prev = prevChapterRef.current;
    prevChapterRef.current = progressChapter;
    if (prev === undefined || prev === progressChapter) return;

    const meta = runtime.chapters.find((c) => c.id === progressChapter);
    const title =
      meta?.display_name ||
      meta?.hud_label ||
      chapterLabels[progressChapter] ||
      progressChapter;
    const ordinal = meta != null ? meta.rank + 1 : undefined;
    setChapterCue({ key: Date.now(), ordinal, title });
  }, [progressChapter, runtime, chapterLabels]);

  const clearChapterCue = useCallback(() => {
    setChapterCue(null);
  }, []);

  useEffect(() => {
    if (!npcState || !chatOpen) return;

    const affDelta = npcState.affinity - prevStateRef.current.affinity;
    const fatDelta = npcState.fatigue - prevStateRef.current.fatigue;
    if (affDelta !== 0 || fatDelta !== 0) {
      setDeltas({
        affinity: affDelta || undefined,
        fatigue: fatDelta || undefined,
      });
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

  // 包加载完后不再因切换 NPC 整页卸载 Canvas（否则玩家位置/视角会被重置）
  if (packLoading) {
    return (
      <main
        className="flex h-screen w-screen items-center justify-center"
        style={{ background: 'var(--ui-bg)', color: 'var(--ui-fg-muted)' }}
      >
        加载剧情包…
      </main>
    );
  }

  if (packError || !runtime) {
    return (
      <main
        className="flex h-screen w-screen items-center justify-center"
        style={{ background: 'var(--ui-bg)', color: 'var(--ui-danger)' }}
      >
        无法加载剧情包：{packError ?? 'unknown'}（请确认 server 已启动）
      </main>
    );
  }

  const runtimeNpcName =
    runtime.npcs.find((n) => n.npc_id === (activeNpcId || defaultNpcId))
      ?.name ?? 'NPC';
  // 显示名以 Pack 为准，避免切人时 useNpcConfig 短暂残留上一任名字导致流式盖写
  const chatNpcName = runtimeNpcName;
  const chatNpcId = activeNpcId || defaultNpcId;

  const affinity = npcState?.affinity ?? npc?.runtime.affinity ?? 0;
  const fatigue = npcState?.fatigue ?? npc?.runtime.fatigue ?? 0;
  const maxFatigue = npcState?.maxFatigue ?? npc?.max_fatigue ?? 100;
  const chapterId = worldChapter;
  const chapterMeta = runtime.chapters.find((c) => c.id === chapterId);
  const chapterDisplayName =
    chapterMeta?.display_name ||
    chapterMeta?.hud_label ||
    chapterLabels[chapterId] ||
    chapterId;
  const chapterOrdinal =
    chapterMeta != null ? chapterMeta.rank + 1 : undefined;
  const chapterHudText =
    chapterOrdinal != null
      ? `第${chapterOrdinal}章：${chapterDisplayName}`
      : chapterDisplayName
        ? `章节：${chapterDisplayName}`
        : null;

  const hintNames = visibleNpcs.map((n) => n.name).join(' / ') || chatNpcName;

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-white">
      <GameCanvas
        npcs={sceneNpcs}
        onPlayerMove={handlePlayerMove}
        movementEnabled={movementEnabled}
        lookEnabled={lookEnabled}
        onPointerLockChange={setPointerLocked}
        uiOverlayActive={uiBlocking}
        speakingNpcId={exchangeSpeakNpcId}
        presenceSnapToken={presenceSnapToken}
      />

      <div className="absolute top-4 left-4 z-30 space-y-2">
        <div className="pointer-events-none space-y-1">
          <h1 className="text-lg font-bold text-gray-800">
            {runtime.selection.world_id}/{runtime.selection.pack_version_id}
          </h1>
          <p className="text-xs text-gray-500">
            WASD 移动 · Esc 菜单 · 靠近 {hintNames} 按 F
          </p>
          <p
            className={`text-xs ${connected ? 'text-emerald-600' : 'text-red-500'}`}
          >
            {connected ? '● 已连接服务器' : '○ 未连接服务器 (4000)'}
          </p>
          <p className="text-xs text-gray-400">当前账号：{username}</p>
          {npcError ? (
            <p className="text-xs text-amber-600">NPC 配置暂不可用：{npcError}</p>
          ) : null}
        </div>

        <HUD
          visible={chatOpen}
          name={chatNpcName}
          affinity={affinity}
          fatigue={fatigue}
          maxFatigue={maxFatigue}
          affinityDelta={deltas.affinity}
          fatigueDelta={deltas.fatigue}
        />
      </div>

      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        {chapterHudText ? (
          <p className="pointer-events-none rounded-lg border border-gray-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-amber-800 shadow-sm">
            {chapterHudText}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            if (chatOpen) return;
            document.exitPointerLock();
            setMenuOpen((v) => !v);
          }}
          className="rounded-lg border border-gray-200 bg-white/90 px-3 py-1.5 text-xs text-gray-600 shadow-sm hover:bg-gray-50"
        >
          Esc
        </button>
      </div>

      {!pointerLocked && !uiBlocking && (
        <div className="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <p className="rounded-full border border-gray-200 bg-white/70 px-4 py-2 text-sm text-gray-400/80">
            点击画面锁定鼠标 · Esc 打开菜单
          </p>
        </div>
      )}

      <InteractionPrompt
        visible={nearNpc && !uiBlocking}
        targets={interactTargets}
        onInteract={openChat}
      />

      <ChatBox
        open={chatOpen}
        npcId={chatNpcId}
        npcName={chatNpcName}
        streamText={streamText}
        isStreaming={isStreaming}
        connected={connected}
        lastSaved={lastSaved}
        lastExchange={lastExchange}
        lastAside={lastAside}
        lastEnding={lastEnding}
        archivesList={archivesList}
        loadedConversation={loadedConversation}
        saveError={saveError}
        loadError={loadError}
        chapterLabels={chapterLabels}
        chapterDisplayName={chapterDisplayName}
        chapterId={worldChapter}
        lastNewRun={lastNewRun}
        suggestions={suggestions}
        suggestionsLoading={suggestionsLoading}
        suggestionsError={suggestionsError}
        onClose={closeChat}
        onSend={handleSendChat}
        onRequestAutoplayNext={requestAutoplayNext}
        onSubscribeAutoplayNext={subscribeAutoplayNext}
        onRequestSuggestions={requestSuggestions}
        onClearSuggestions={clearSuggestions}
        onSave={saveConversation}
        onListArchives={listArchives}
        onLoadArchive={loadArchive}
        onRenameArchive={renameArchive}
        onNewRunFromStart={() => startNewRun({})}
        onClearLoadedConversation={clearLoadedConversation}
        onClearLastSaved={clearLastSaved}
        onClearLastNewRun={clearLastNewRun}
        onClearLastExchange={clearLastExchange}
        onClearLastAside={clearLastAside}
        onClearLastEnding={clearLastEnding}
        onExchangeSpeak={handleExchangeSpeak}
      />

      <EscMenu
        open={menuOpen}
        token={token}
        username={username}
        packLabel={`${runtime.selection.world_id}/${runtime.selection.pack_version_id}`}
        worldId={runtime.selection.world_id}
        packVersionId={runtime.selection.pack_version_id}
        storyMap={storyMap}
        sceneNpcs={sceneNpcPicker}
        selectedNpcIds={selectedNpcIds}
        onNpcSelectionChange={handleNpcSelectionChange}
        onClose={closeMenu}
        onLogout={logout}
        onSessionUpdate={updateSession}
        onRequestStoryMap={handleRequestStoryMap}
        onStartNewRun={handleStartNewRun}
      />

      <ChapterTransition cue={chapterCue} onDone={clearChapterCue} />
    </main>
  );
}

export default function GamePage() {
  return (
    <AuthGate>
      {({ token, username, logout, updateSession }) => (
        <GamePageInner
          token={token}
          username={username}
          logout={logout}
          updateSession={updateSession}
        />
      )}
    </AuthGate>
  );
}
