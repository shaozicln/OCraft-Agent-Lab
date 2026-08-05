'use client';

import {
  AutoPlaySession,
  buildAutoPlayGoal,
  resolveAutoPlayStopKind,
  type AutoPlayEndingOption,
  type AutoPlayGoal,
  type AutoPlayPrefs,
  type AutoPlayProgressSnapshot,
  type AutoPlayStatus,
  type AutoplayNextEvent,
} from '@ocraft/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

export type AutoPlayUiState = {
  status: AutoPlayStatus;
  turnIndex: number;
  total: number;
  progressLabel: string;
  title: string;
  failReason?: string;
  takeoverMode: 'allow' | 'watch_only';
  intervening: boolean;
  accelerate: boolean;
  needsAcceleratePrompt: boolean;
  enterEpilogue: boolean;
};

const SETTLE_MS = 600;
const POST_STREAM_GRACE_MS = 1800;
const BUSY_TIMEOUT_MS = 90_000;
const NEXT_TIMEOUT_MS = 45_000;

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('aborted', 'AbortError'));
      return;
    }
    const t = window.setTimeout(() => resolve(), ms);
    const onAbort = () => {
      window.clearTimeout(t);
      reject(new DOMException('aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function waitWhilePaused(
  getStatus: () => AutoPlayStatus,
  getIntervening: () => boolean,
  signal: AbortSignal,
): Promise<void> {
  while (
    !signal.aborted &&
    (getStatus() === 'paused' || getIntervening())
  ) {
    await delay(120, signal);
  }
}

async function waitUntilSettled(
  isBusy: () => boolean,
  signal: AbortSignal,
): Promise<void> {
  const deadline = Date.now() + BUSY_TIMEOUT_MS;
  let clearSince: number | null = null;
  while (!signal.aborted) {
    if (Date.now() > deadline) {
      throw new Error('等待演出超时');
    }
    if (isBusy()) {
      clearSince = null;
    } else if (clearSince == null) {
      clearSince = Date.now();
    } else if (Date.now() - clearSince >= SETTLE_MS) {
      return;
    }
    await delay(80, signal);
  }
  throw new DOMException('aborted', 'AbortError');
}

async function waitTurnComplete(
  isStreaming: () => boolean,
  isBusy: () => boolean,
  signal: AbortSignal,
): Promise<void> {
  const startWait = Date.now();
  while (
    !signal.aborted &&
    !isStreaming() &&
    Date.now() - startWait < 4000
  ) {
    await delay(50, signal);
  }
  const streamDeadline = Date.now() + BUSY_TIMEOUT_MS;
  while (!signal.aborted && isStreaming()) {
    if (Date.now() > streamDeadline) throw new Error('等待回复超时');
    await delay(50, signal);
  }
  await delay(POST_STREAM_GRACE_MS, signal);
  await waitUntilSettled(isBusy, signal);
}

const idleUi = (): AutoPlayUiState => ({
  status: 'idle',
  turnIndex: 0,
  total: 100,
  progressLabel: '',
  title: '',
  takeoverMode: 'allow',
  intervening: false,
  accelerate: false,
  needsAcceleratePrompt: false,
  enterEpilogue: false,
});

export function useAutoPlay(opts: {
  npcId: string;
  isBusy: boolean;
  isStreaming: boolean;
  chapterId?: string;
  lastExchangeId?: string | null;
  lastEndingId?: string | null;
  connected: boolean;
  packMeta?: {
    world_id?: string;
    version_dir?: string;
    display_name?: string;
    endings?: AutoPlayEndingOption[];
    chapters?: { id: string }[];
  };
  /** AP-3：开演时按进度筛可达结局 */
  progress?: AutoPlayProgressSnapshot | null;
  onSendAuto: (message: string) => boolean;
  /** AP-1：纯 NPC 拍已服务端落档，客户端只刷 UI */
  onApplyBeatLines?: (
    lines: NonNullable<AutoplayNextEvent['lines']>,
  ) => void;
  onRequestNext: (payload: {
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
    nearbyNpcIds?: string[];
  }) => boolean;
  getNearbyNpcIds?: () => string[];
  subscribeNext: (handler: (ev: AutoplayNextEvent) => void) => () => void;
  onNote: (text: string) => void;
}) {
  const sessionRef = useRef<AutoPlaySession | null>(null);
  const goalRef = useRef<AutoPlayGoal | null>(null);
  const runGenRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(opts.isBusy);
  const streamingRef = useRef(opts.isStreaming);
  const chapterRef = useRef(opts.chapterId);
  const exchangeRef = useRef(opts.lastExchangeId);
  const endingRef = useRef(opts.lastEndingId);
  const onSendAutoRef = useRef(opts.onSendAuto);
  const onApplyBeatLinesRef = useRef(opts.onApplyBeatLines);
  const onRequestNextRef = useRef(opts.onRequestNext);
  const getNearbyNpcIdsRef = useRef(opts.getNearbyNpcIds);
  const progressRef = useRef(opts.progress);
  const subscribeNextRef = useRef(opts.subscribeNext);
  const onNoteRef = useRef(opts.onNote);
  const priorSaysRef = useRef<string[]>([]);

  busyRef.current = opts.isBusy;
  streamingRef.current = opts.isStreaming;
  chapterRef.current = opts.chapterId;
  exchangeRef.current = opts.lastExchangeId;
  endingRef.current = opts.lastEndingId;
  onSendAutoRef.current = opts.onSendAuto;
  onApplyBeatLinesRef.current = opts.onApplyBeatLines;
  onRequestNextRef.current = opts.onRequestNext;
  getNearbyNpcIdsRef.current = opts.getNearbyNpcIds;
  progressRef.current = opts.progress;
  subscribeNextRef.current = opts.subscribeNext;
  onNoteRef.current = opts.onNote;

  const [ui, setUi] = useState<AutoPlayUiState>(idleUi);

  const syncUi = useCallback(() => {
    const s = sessionRef.current;
    const g = goalRef.current;
    if (!s || !g) {
      setUi(idleUi());
      return;
    }
    setUi({
      status: s.status,
      turnIndex: s.turnIndex,
      total: g.chapter_speak_cap,
      progressLabel: s.progressLabel,
      title: g.title,
      failReason: s.failReason,
      takeoverMode: g.takeover_mode,
      intervening: s.intervening,
      accelerate: s.accelerate,
      needsAcceleratePrompt: s.needsAcceleratePrompt,
      enterEpilogue: g.enter_epilogue,
    });
  }, []);

  const stopRunner = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const waitForNext = useCallback(
    (npcId: string, signal: AbortSignal): Promise<AutoplayNextEvent> => {
      return new Promise((resolve, reject) => {
        if (signal.aborted) {
          reject(new DOMException('aborted', 'AbortError'));
          return;
        }
        const timer = window.setTimeout(() => {
          unsub();
          reject(new Error('等待下一拍超时'));
        }, NEXT_TIMEOUT_MS);
        const onAbort = () => {
          window.clearTimeout(timer);
          unsub();
          reject(new DOMException('aborted', 'AbortError'));
        };
        signal.addEventListener('abort', onAbort, { once: true });
        const unsub = subscribeNextRef.current((ev) => {
          if (ev.npcId !== npcId) return;
          window.clearTimeout(timer);
          signal.removeEventListener('abort', onAbort);
          unsub();
          resolve(ev);
        });
      });
    },
    [],
  );

  const finishWithGoal = useCallback(
    (session: AutoPlaySession, goal: AutoPlayGoal, note: string) => {
      const kind = resolveAutoPlayStopKind(goal, {
        chapter: chapterRef.current,
        endingId: endingRef.current,
        sawTargetExchange: session.sawTargetExchange,
      });
      session.complete(note);
      if (kind === 'ending' && goal.enter_epilogue) {
        onNoteRef.current(
          '自动演完成 · 已达结局。杀青梗将在后续版本进入（本局已勾选）。',
        );
      } else if (kind === 'chapter') {
        onNoteRef.current(
          '自动演完成 · 已到所选章节停点（未进杀青；杀青仅在打到结局后）。',
        );
      } else if (kind === 'final_chapter') {
        onNoteRef.current('自动演完成 · 已到最终章（本包无可用结局）。');
      } else {
        onNoteRef.current(note);
      }
      syncUi();
    },
    [syncUi],
  );

  const runLoop = useCallback(
    async (gen: number) => {
      const session = sessionRef.current;
      const goal = goalRef.current;
      if (!session || !goal) return;
      const ac = new AbortController();
      abortRef.current = ac;
      const { signal } = ac;
      priorSaysRef.current = [];

      try {
        while (
          gen === runGenRef.current &&
          !signal.aborted &&
          session.status === 'running'
        ) {
          await waitWhilePaused(
            () => session.status,
            () => session.intervening,
            signal,
          );
          if (session.status !== 'running') break;

          if (
            session.goalReached(chapterRef.current, endingRef.current)
          ) {
            finishWithGoal(session, goal, '自动演完成 · 目标已达成');
            break;
          }

          // 加速时缩短拍间等待，并配合服务端注入升章关键词
          const waitMs = session.accelerate
            ? Math.min(goal.wait_ms ?? 800, 200)
            : (goal.wait_ms ?? 0);
          if (waitMs > 0) await delay(waitMs, signal);

          await waitWhilePaused(
            () => session.status,
            () => session.intervening,
            signal,
          );
          if (session.status !== 'running') break;

          // 章顶：暂停等用户选保持/加速（侧栏也可随时加速）
          if (session.needsAcceleratePrompt && !session.accelerate) {
            session.pause();
            syncUi();
            onNoteRef.current(
              '本章发言已达上限 · 请选择「保持」继续或「加速」推进（也可点侧栏加速）',
            );
            await waitWhilePaused(
              () => session.status,
              () => session.intervening,
              signal,
            );
            if (session.status !== 'running') break;
          }

          const reqOk = onRequestNextRef.current({
            turnIndex: session.turnIndex,
            maxTurns: goal.chapter_speak_cap,
            chapterSpeakCap: goal.chapter_speak_cap,
            priorSays: [...priorSaysRef.current],
            sawTargetExchange: session.sawTargetExchange,
            targetChapter: goal.target_chapter,
            targetExchange: goal.target_exchange,
            targetEnding: goal.target_ending,
            styleId: goal.style_id,
            goalTitle: goal.title,
            accelerate: session.accelerate,
            nearbyNpcIds: getNearbyNpcIdsRef.current?.() ?? [],
          });
          if (!reqOk) {
            session.fail('请求下一拍失败');
            onNoteRef.current('自动演绎中断：请求下一拍失败');
            syncUi();
            break;
          }

          const next = await waitForNext(opts.npcId, signal);
          if (next.error) {
            session.fail(next.error);
            onNoteRef.current(`自动演绎中断：${next.error}`);
            syncUi();
            break;
          }

          const beatLines = next.lines ?? [];
          const playerSay =
            next.say?.trim() ||
            beatLines.find((l) => l.speaker_kind === 'player')?.text?.trim();

          if (next.done && !playerSay && beatLines.length === 0) {
            finishWithGoal(
              session,
              goal,
              `自动演完成 · ${next.reason || '可继续手动交谈'}`,
            );
            break;
          }

          onNoteRef.current(
            `自动演演算 · ${next.source === 'mock' ? '启发' : '导演'}：${next.reason || '排场'}`,
          );

          // AP-1：纯 NPC 拍（服务端已 applied）
          if (next.applied && beatLines.length > 0 && !playerSay) {
            onApplyBeatLinesRef.current?.(beatLines);
            await delay(Math.max(SETTLE_MS, goal.wait_ms ?? 400), signal);
            await waitUntilSettled(() => busyRef.current, signal);

            if (
              session.goalReached(chapterRef.current, endingRef.current)
            ) {
              finishWithGoal(session, goal, '自动演完成 · 目标已达成');
              break;
            }
            if (next.done) {
              finishWithGoal(
                session,
                goal,
                `自动演完成 · ${next.reason || '可继续手动交谈'}`,
              );
              break;
            }
            if (session.status !== 'running') break;
            session.advance(chapterRef.current);
            syncUi();
            continue;
          }

          if (!playerSay) {
            session.fail('下一拍无台词');
            onNoteRef.current('自动演绎中断：下一拍无台词');
            syncUi();
            break;
          }

          const exchangeBefore = exchangeRef.current ?? null;
          const ok = onSendAutoRef.current(playerSay);
          if (!ok) {
            session.fail('发送失败');
            onNoteRef.current('自动演绎中断：发送失败');
            syncUi();
            break;
          }
          priorSaysRef.current = [...priorSaysRef.current, playerSay];

          await waitTurnComplete(
            () => streamingRef.current,
            () => busyRef.current,
            signal,
          );

          const exchangeAfter = exchangeRef.current ?? null;
          if (exchangeAfter && exchangeAfter !== exchangeBefore) {
            session.markExchange(exchangeAfter);
          }

          if (
            session.goalReached(chapterRef.current, endingRef.current)
          ) {
            finishWithGoal(session, goal, '自动演完成 · 目标已达成');
            break;
          }

          if (next.done) {
            finishWithGoal(
              session,
              goal,
              `自动演完成 · ${next.reason || '可继续手动交谈'}`,
            );
            break;
          }

          if (session.status !== 'running') break;
          session.advance(chapterRef.current);
          syncUi();
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          syncUi();
          return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        session.fail(msg);
        onNoteRef.current(`自动演绎中断：${msg}`);
        syncUi();
      } finally {
        if (abortRef.current === ac) abortRef.current = null;
      }
    },
    [finishWithGoal, opts.npcId, syncUi, waitForNext],
  );

  const startWithPrefs = useCallback(
    (prefs: AutoPlayPrefs) => {
      if (!opts.connected) {
        onNoteRef.current('自动演绎失败：未连接服务器');
        return;
      }
      if (!opts.npcId) {
        onNoteRef.current('自动演绎失败：未选择对话角色');
        return;
      }
      const goal = buildAutoPlayGoal({
        npcId: opts.npcId,
        prefs,
        pack: opts.packMeta,
        progress: progressRef.current,
      });
      stopRunner();
      goalRef.current = goal;
      sessionRef.current = new AutoPlaySession(goal);
      if (!sessionRef.current.start()) return;
      const gen = ++runGenRef.current;
      syncUi();
      onNoteRef.current(`开始自动演绎：${goal.title}`);
      void runLoop(gen);
    },
    [opts.connected, opts.npcId, opts.packMeta, runLoop, stopRunner, syncUi],
  );

  const pause = useCallback((note?: string) => {
    if (sessionRef.current?.pause()) {
      syncUi();
      onNoteRef.current(note ?? '自动演绎已暂停');
    }
  }, [syncUi]);

  const resume = useCallback(() => {
    const s = sessionRef.current;
    if (!s?.resume()) return;
    syncUi();
    onNoteRef.current('自动演绎继续');
    if (!abortRef.current) {
      const gen = ++runGenRef.current;
      void runLoop(gen);
    }
  }, [runLoop, syncUi]);

  /** 保持现状：清提示并继续（不加速） */
  const keepPace = useCallback(() => {
    const s = sessionRef.current;
    if (!s?.isActive()) return;
    s.clearAcceleratePrompt();
    if (s.status === 'paused' && !s.intervening) {
      s.resume();
    }
    syncUi();
    onNoteRef.current('保持当前节奏，继续自动演绎');
    if (!abortRef.current && s.status === 'running') {
      const gen = ++runGenRef.current;
      void runLoop(gen);
    }
  }, [runLoop, syncUi]);

  const setAccelerate = useCallback(
    (on: boolean) => {
      const s = sessionRef.current;
      if (!s?.isActive()) return;
      s.setAccelerate(on);
      if (on && s.status === 'paused' && !s.intervening) {
        s.resume();
      }
      syncUi();
      onNoteRef.current(on ? '已开启加速推进' : '已关闭加速');
      if (!abortRef.current && s.status === 'running') {
        const gen = ++runGenRef.current;
        void runLoop(gen);
      }
    },
    [runLoop, syncUi],
  );

  const takeover = useCallback(() => {
    const s = sessionRef.current;
    if (!s?.enterIntervene()) return;
    syncUi();
    onNoteRef.current('已接管 · 可手动输入；点「交回」继续自动演');
  }, [syncUi]);

  const handBack = useCallback(() => {
    const s = sessionRef.current;
    if (!s?.handBack()) return;
    syncUi();
    onNoteRef.current('已交回 · 继续自动演绎');
    if (!abortRef.current) {
      const gen = ++runGenRef.current;
      void runLoop(gen);
    }
  }, [runLoop, syncUi]);

  const stop = useCallback((note?: string) => {
    stopRunner();
    if (sessionRef.current?.isActive()) {
      sessionRef.current.stop('停止');
      syncUi();
      onNoteRef.current(note ?? '自动演绎已停止');
    }
  }, [stopRunner, syncUi]);

  const dismiss = useCallback(() => {
    stopRunner();
    sessionRef.current = null;
    goalRef.current = null;
    setUi(idleUi());
  }, [stopRunner]);

  /** 观察箱：关窗不停演；保留 API 避免 HMR 旧调用崩溃 */
  const stopOnClose = useCallback(() => {}, []);

  useEffect(() => () => stopRunner(), [stopRunner]);

  return {
    ui,
    locksInput:
      ui.intervening
        ? false
        : ui.status === 'running' || ui.status === 'paused',
    startWithPrefs,
    pause,
    resume,
    keepPace,
    setAccelerate,
    takeover,
    handBack,
    stop,
    dismiss,
    stopOnClose,
  };
}
