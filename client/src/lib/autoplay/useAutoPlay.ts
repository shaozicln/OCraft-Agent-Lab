'use client';

import {
  AutoPlaySession,
  FEEL_DEMO_AUTO_GOAL,
  type AutoPlayGoal,
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
  signal: AbortSignal,
): Promise<void> {
  while (!signal.aborted && getStatus() === 'paused') {
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

export function useAutoPlay(opts: {
  goal?: AutoPlayGoal;
  npcId: string;
  isBusy: boolean;
  isStreaming: boolean;
  chapterId?: string;
  lastExchangeId?: string | null;
  connected: boolean;
  onSendAuto: (message: string) => boolean;
  onRequestNext: (payload: {
    turnIndex: number;
    maxTurns: number;
    priorSays: string[];
    sawTargetExchange: boolean;
    targetChapter?: string;
    targetExchange?: string;
  }) => boolean;
  /** 订阅下一拍结果；返回取消函数 */
  subscribeNext: (handler: (ev: AutoplayNextEvent) => void) => () => void;
  onNote: (text: string) => void;
}) {
  const goal = opts.goal ?? FEEL_DEMO_AUTO_GOAL;
  const sessionRef = useRef(new AutoPlaySession(goal));
  const runGenRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(opts.isBusy);
  const streamingRef = useRef(opts.isStreaming);
  const chapterRef = useRef(opts.chapterId);
  const exchangeRef = useRef(opts.lastExchangeId);
  const onSendAutoRef = useRef(opts.onSendAuto);
  const onRequestNextRef = useRef(opts.onRequestNext);
  const subscribeNextRef = useRef(opts.subscribeNext);
  const onNoteRef = useRef(opts.onNote);
  const priorSaysRef = useRef<string[]>([]);

  busyRef.current = opts.isBusy;
  streamingRef.current = opts.isStreaming;
  chapterRef.current = opts.chapterId;
  exchangeRef.current = opts.lastExchangeId;
  onSendAutoRef.current = opts.onSendAuto;
  onRequestNextRef.current = opts.onRequestNext;
  subscribeNextRef.current = opts.subscribeNext;
  onNoteRef.current = opts.onNote;

  const [ui, setUi] = useState<AutoPlayUiState>(() => ({
    status: 'idle',
    turnIndex: 0,
    total: goal.max_turns,
    progressLabel: `1/${goal.max_turns}`,
    title: goal.title,
  }));

  const syncUi = useCallback(() => {
    const s = sessionRef.current;
    setUi({
      status: s.status,
      turnIndex: s.turnIndex,
      total: s.goal.max_turns,
      progressLabel: s.progressLabel,
      title: s.goal.title,
      failReason: s.failReason,
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

  const runLoop = useCallback(
    async (gen: number) => {
      const session = sessionRef.current;
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
          await waitWhilePaused(() => session.status, signal);
          if (session.status !== 'running') break;

          if (session.goalReached(chapterRef.current)) {
            session.complete('目标达成');
            onNoteRef.current('自动演完成 · 目标已达成，可继续手动交谈');
            syncUi();
            break;
          }

          const waitMs = session.goal.wait_ms ?? 0;
          if (waitMs > 0) await delay(waitMs, signal);

          await waitWhilePaused(() => session.status, signal);
          if (session.status !== 'running') break;

          const reqOk = onRequestNextRef.current({
            turnIndex: session.turnIndex,
            maxTurns: session.goal.max_turns,
            priorSays: [...priorSaysRef.current],
            sawTargetExchange: session.sawTargetExchange,
            targetChapter: session.goal.target_chapter,
            targetExchange: session.goal.target_exchange,
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

          if (next.done && !next.say?.trim()) {
            session.complete(next.reason || 'Agent 结束');
            onNoteRef.current(
              `自动演完成 · ${next.reason || '可继续手动交谈'}`,
            );
            syncUi();
            break;
          }

          const say = next.say?.trim();
          if (!say) {
            session.fail('下一拍无玩家句');
            onNoteRef.current('自动演绎中断：下一拍无玩家句');
            syncUi();
            break;
          }

          onNoteRef.current(
            `自动演演算 · ${next.source === 'mock' ? 'MOCK' : 'Agent'}：${next.reason || '代发'}`,
          );

          const exchangeBefore = exchangeRef.current ?? null;
          const ok = onSendAutoRef.current(say);
          if (!ok) {
            session.fail('发送失败');
            onNoteRef.current('自动演绎中断：发送失败');
            syncUi();
            break;
          }
          priorSaysRef.current = [...priorSaysRef.current, say];

          await waitTurnComplete(
            () => streamingRef.current,
            () => busyRef.current,
            signal,
          );

          const exchangeAfter = exchangeRef.current ?? null;
          if (exchangeAfter && exchangeAfter !== exchangeBefore) {
            session.markExchange(exchangeAfter);
          }

          if (session.goalReached(chapterRef.current)) {
            session.complete('目标达成');
            onNoteRef.current('自动演完成 · 目标已达成，可继续手动交谈');
            syncUi();
            break;
          }

          if (next.done) {
            session.complete(next.reason || 'Agent 结束');
            onNoteRef.current(
              `自动演完成 · ${next.reason || '可继续手动交谈'}`,
            );
            syncUi();
            break;
          }

          if (session.status !== 'running') break;
          session.advance();
          syncUi();

          if (String(session.status) === 'done') {
            onNoteRef.current('自动演完成 · 已达最大拍数，可继续手动交谈');
            break;
          }
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
    [opts.npcId, syncUi, waitForNext],
  );

  const start = useCallback(() => {
    if (!opts.connected) {
      onNoteRef.current('自动演绎失败：未连接服务器');
      return;
    }
    if (opts.npcId !== goal.npc_id) {
      onNoteRef.current(
        `请先与剧本焦点角色交谈（需要 ${goal.npc_id}，当前 ${opts.npcId}）`,
      );
      return;
    }
    stopRunner();
    sessionRef.current = new AutoPlaySession(goal);
    if (!sessionRef.current.start()) return;
    const gen = ++runGenRef.current;
    syncUi();
    onNoteRef.current(`开始自动演（实时演算）：${goal.title}`);
    void runLoop(gen);
  }, [goal, opts.connected, opts.npcId, runLoop, stopRunner, syncUi]);

  const pause = useCallback(() => {
    if (sessionRef.current.pause()) {
      syncUi();
      onNoteRef.current('自动演绎已暂停');
    }
  }, [syncUi]);

  const resume = useCallback(() => {
    if (!sessionRef.current.resume()) return;
    syncUi();
    onNoteRef.current('自动演绎继续');
    if (!abortRef.current) {
      const gen = ++runGenRef.current;
      void runLoop(gen);
    }
  }, [runLoop, syncUi]);

  const takeover = useCallback(() => {
    stopRunner();
    if (sessionRef.current.isActive()) {
      sessionRef.current.stop('接管');
      syncUi();
      onNoteRef.current('已接管 · 可手动输入');
    }
  }, [stopRunner, syncUi]);

  useEffect(() => () => stopRunner(), [stopRunner]);

  return {
    ui,
    locksInput: ui.status === 'running' || ui.status === 'paused',
    start,
    pause,
    resume,
    takeover,
    goal,
  };
}
