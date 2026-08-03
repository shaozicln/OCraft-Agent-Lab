'use client';

import {
  AUTO_PLAY_STYLE_PRESETS,
  CHAPTER_SPEAK_CAP_COST_WARN,
  DEFAULT_AUTO_PLAY_STYLE_ID,
  DEFAULT_CHAPTER_SPEAK_CAP,
  autoPlayPrefsSchema,
  type AutoPlayEndingOption,
  type AutoPlayPrefs,
} from '@ocraft/shared';
import { useEffect, useMemo, useState } from 'react';

type ChapterOpt = { id: string; label: string };

type Props = {
  open: boolean;
  npcName: string;
  chapters: ChapterOpt[];
  endings: AutoPlayEndingOption[];
  /** Pack 默认风格；本局可覆盖 */
  packDefaultStyleId?: string;
  onClose: () => void;
  onConfirm: (prefs: AutoPlayPrefs) => void;
};

export function AutoPlaySetupModal({
  open,
  npcName,
  chapters,
  endings,
  packDefaultStyleId,
  onClose,
  onConfirm,
}: Props) {
  const enabledEndings = useMemo(
    () => endings.filter((e) => e.enabled !== false),
    [endings],
  );
  const hasEndings = enabledEndings.length > 0;
  const initialStyle =
    packDefaultStyleId &&
    AUTO_PLAY_STYLE_PRESETS.some((s) => s.id === packDefaultStyleId)
      ? packDefaultStyleId
      : DEFAULT_AUTO_PLAY_STYLE_ID;

  const [styleId, setStyleId] = useState(initialStyle);
  const [stopAtChapter, setStopAtChapter] = useState('');
  const [endingMode, setEndingMode] = useState<'specific' | 'random'>(
    hasEndings ? 'random' : 'specific',
  );
  const [targetEndingId, setTargetEndingId] = useState(
    enabledEndings[0]?.id ?? '',
  );
  const [takeoverMode, setTakeoverMode] = useState<'allow' | 'watch_only'>(
    'allow',
  );
  const [chapterSpeakCap, setChapterSpeakCap] = useState(
    DEFAULT_CHAPTER_SPEAK_CAP,
  );
  const [enterEpilogue, setEnterEpilogue] = useState(false);
  const [epilogueMode, setEpilogueMode] = useState<'a' | 'b' | 'c'>('a');

  // 每次打开用 Pack 默认风格重置（本局可再改）
  useEffect(() => {
    if (!open) return;
    setStyleId(initialStyle);
  }, [open, initialStyle]);

  if (!open) return null;

  const capWarn = chapterSpeakCap > CHAPTER_SPEAK_CAP_COST_WARN;

  const submit = () => {
    if (hasEndings) {
      if (endingMode === 'specific' && !targetEndingId) return;
    }
    const prefs = autoPlayPrefsSchema.parse({
      style_id: styleId,
      stop_at_chapter: stopAtChapter || undefined,
      ending_mode: hasEndings ? endingMode : 'final_chapter',
      target_ending_id:
        hasEndings && endingMode === 'specific'
          ? targetEndingId || undefined
          : undefined,
      takeover_mode: takeoverMode,
      wait_ms: 800,
      chapter_speak_cap: chapterSpeakCap,
      enter_epilogue: hasEndings ? enterEpilogue : false,
      epilogue_mode: enterEpilogue ? epilogueMode : undefined,
    });
    onConfirm(prefs);
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: 'rgba(2,6,23,0.72)' }}
      role="dialog"
      aria-modal="true"
      aria-label="自动演绎设置"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-600 bg-slate-900 text-slate-100 shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-700 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">自动演绎设置</h2>
            <p className="mt-1 text-xs text-slate-400">
              焦点：{npcName} · 必选结局（或最终章）· 目标来自当前剧本
            </p>
          </div>
          <button
            type="button"
            className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300"
            onClick={onClose}
          >
            关闭
          </button>
        </div>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-4 py-3 text-sm">
          <p className="text-xs font-medium text-slate-300">正片</p>

          <label className="block">
            <span className="text-xs text-slate-400">
              风格（可覆盖 Pack 默认，不写回）
            </span>
            <select
              className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5"
              value={styleId}
              onChange={(e) => setStyleId(e.target.value)}
            >
              {AUTO_PLAY_STYLE_PRESETS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} — {s.blurb}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="space-y-1">
            <legend className="text-xs text-slate-400">结局目标（必选）</legend>
            {hasEndings ? (
              <>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={endingMode === 'specific'}
                    onChange={() => setEndingMode('specific')}
                  />
                  指定结局
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={endingMode === 'random'}
                    onChange={() => setEndingMode('random')}
                  />
                  随机结局
                </label>
                {endingMode === 'specific' && (
                  <select
                    className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5"
                    value={targetEndingId}
                    onChange={(e) => setTargetEndingId(e.target.value)}
                  >
                    {enabledEndings.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.display_name}（{e.id}）
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[11px] text-slate-500">
                  列表为当前包启用结局；完整「进度可达」筛选后续对齐。
                </p>
              </>
            ) : (
              <p className="text-xs text-amber-200/90">
                本包无可用结局：将演到最终章后停止（不可进杀青）。
              </p>
            )}
          </fieldset>

          <label className="block">
            <span className="text-xs text-slate-400">
              停在章节（可选；先到则停正片、不进杀青）
            </span>
            <select
              className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5"
              value={stopAtChapter}
              onChange={(e) => setStopAtChapter(e.target.value)}
            >
              <option value="">不设章停（直通结局/最终章）</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-slate-400">
              每章最多发言次数（默认 {DEFAULT_CHAPTER_SPEAK_CAP}，换章清零）
            </span>
            <input
              type="number"
              min={1}
              max={10000}
              className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5"
              value={chapterSpeakCap}
              onChange={(e) =>
                setChapterSpeakCap(Number(e.target.value) || DEFAULT_CHAPTER_SPEAK_CAP)
              }
            />
            {capWarn ? (
              <p className="mt-1 text-[11px] text-amber-300/90">
                超过 {CHAPTER_SPEAK_CAP_COST_WARN}{' '}
                可能导致 token 消耗过大与模型费用升高。
              </p>
            ) : null}
          </label>

          <fieldset className="space-y-1">
            <legend className="text-xs text-slate-400">旁观 / 接管</legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={takeoverMode === 'allow'}
                onChange={() => setTakeoverMode('allow')}
              />
              可随时接管（暂停 + 介入 + 交回）
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={takeoverMode === 'watch_only'}
                onChange={() => setTakeoverMode('watch_only')}
              />
              只旁观（暂停 + 停止，不能介入）
            </label>
          </fieldset>

          <label className="flex items-start gap-2 border-t border-slate-700 pt-3">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={enterEpilogue}
              disabled={!hasEndings}
              onChange={(e) => setEnterEpilogue(e.target.checked)}
            />
            <span>
              <span className="text-sm">演完进杀青梗</span>
              <span className="mt-0.5 block text-[11px] text-slate-500">
                仅打到结局后进入；章停不会进杀青。杀青演出逻辑后续版本落地。
              </span>
            </span>
          </label>

          {enterEpilogue && hasEndings ? (
            <fieldset className="space-y-1 rounded border border-slate-700 p-2">
              <legend className="px-1 text-xs text-slate-400">杀青台面（占位）</legend>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={epilogueMode === 'a'}
                  onChange={() => setEpilogueMode('a')}
                />
                A 演员局
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={epilogueMode === 'b'}
                  onChange={() => setEpilogueMode('b')}
                />
                B 无玩家位向
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={epilogueMode === 'c'}
                  onChange={() => setEpilogueMode('c')}
                />
                C 创世神梗
              </label>
            </fieldset>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-700 px-4 py-3">
          <button
            type="button"
            className="rounded border border-slate-600 px-3 py-1.5 text-xs"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className="rounded border border-amber-500/50 bg-amber-500/20 px-3 py-1.5 text-xs text-amber-100"
            onClick={submit}
          >
            开始自动演绎
          </button>
        </div>
      </div>
    </div>
  );
}
