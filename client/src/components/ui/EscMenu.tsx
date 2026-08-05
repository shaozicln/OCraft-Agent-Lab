'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type {
  AuthSession,
  PlayerAccount,
  PlayerPackProfile,
  StoryMapEvent,
} from '@ocraft/shared';
import { resolveProfileFields } from '@ocraft/shared';
import { apiFetch } from '@/lib/api';
import { useTheme } from '@/theme/ThemeProvider';
import { StoryProgressMap } from './StoryProgressMap';
import './esc-menu.css';

const GENDER_LABEL: Record<string, string> = {
  male: '男',
  female: '女',
  other: '其他',
  undisclosed: '未透露',
};

const WIDTH_STORAGE_KEY = 'ocraft.escMenu.width';
const WIDTH_DEFAULT = 320;
const WIDTH_MIN = 240;
const WIDTH_MAX = 560;

function clampMenuWidth(px: number) {
  const maxByViewport =
    typeof window !== 'undefined'
      ? Math.min(WIDTH_MAX, Math.floor(window.innerWidth * 0.55))
      : WIDTH_MAX;
  return Math.min(maxByViewport, Math.max(WIDTH_MIN, Math.round(px)));
}

function readStoredWidth() {
  if (typeof window === 'undefined') return WIDTH_DEFAULT;
  const raw = window.localStorage.getItem(WIDTH_STORAGE_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? clampMenuWidth(n) : WIDTH_DEFAULT;
}

interface EscMenuProps {
  open: boolean;
  token: string;
  username: string;
  packLabel?: string;
  worldId?: string;
  packVersionId?: string;
  storyMap?: StoryMapEvent | null;
  runBusy?: boolean;
  /** 本包全部 NPC + 是否已满足出场条件 */
  sceneNpcs?: Array<{ npcId: string; name: string; eligible: boolean }>;
  /** null = 全部已可出场 */
  selectedNpcIds?: string[] | null;
  onNpcSelectionChange?: (npcIds: string[] | null) => void;
  onClose: () => void;
  onLogout: () => void;
  onSessionUpdate?: (session: AuthSession) => void;
  onRequestStoryMap?: () => void;
  onStartNewRun?: (opts: {
    chapterId?: string;
    viaRuleId?: string;
    displayName?: string;
  }) => void;
  /** AP-4：全场自动演入口 */
  onRequestAutoPlay?: () => void;
  /** AP-4：左侧历史入口 */
  onRequestHistory?: () => void;
}

export function EscMenu({
  open,
  token,
  username,
  packLabel,
  worldId,
  packVersionId,
  storyMap = null,
  runBusy = false,
  sceneNpcs = [],
  selectedNpcIds = null,
  onNpcSelectionChange,
  onClose,
  onLogout,
  onSessionUpdate,
  onRequestStoryMap,
  onStartNewRun,
  onRequestAutoPlay,
  onRequestHistory,
}: EscMenuProps) {
  const { theme, setTheme } = useTheme();
  const [account, setAccount] = useState<PlayerAccount | null>(null);
  const [packProfile, setPackProfile] = useState<PlayerPackProfile | null>(null);
  const [editingAccount, setEditingAccount] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(WIDTH_DEFAULT);
  const [accountForm, setAccountForm] = useState({
    username: '',
    currentPassword: '',
    newPassword: '',
  });
  const draggingRef = useRef(false);

  useEffect(() => {
    setWidth(readStoredWidth());
  }, []);

  useEffect(() => {
    if (!open) return;
    onRequestStoryMap?.();
  }, [open, onRequestStoryMap]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setEditingAccount(false);

    void (async () => {
      try {
        const acc = await apiFetch<PlayerAccount>('/players/me', { token });
        if (cancelled) return;
        setAccount(acc);
        setAccountForm({
          username: acc.username,
          currentPassword: '',
          newPassword: '',
        });

        if (worldId && packVersionId) {
          const q = new URLSearchParams({ worldId, packVersionId });
          const profile = await apiFetch<PlayerPackProfile>(
            `/players/me/pack-profile?${q}`,
            { token },
          );
          if (!cancelled) setPackProfile(profile);
        } else if (!cancelled) {
          setPackProfile(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载失败');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, token, worldId, packVersionId]);

  const onResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      draggingRef.current = true;
      const handle = e.currentTarget;
      handle.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        if (!draggingRef.current) return;
        setWidth(clampMenuWidth(ev.clientX));
      };
      const onUp = (ev: PointerEvent) => {
        draggingRef.current = false;
        handle.releasePointerCapture(ev.pointerId);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        setWidth((w) => {
          const next = clampMenuWidth(w);
          window.localStorage.setItem(WIDTH_STORAGE_KEY, String(next));
          return next;
        });
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [],
  );

  const eligibleSceneNpcs = sceneNpcs.filter((n) => n.eligible);

  const isNpcChecked = useCallback(
    (npcId: string, eligible: boolean) => {
      if (!eligible) return false;
      if (selectedNpcIds === null) return true;
      return selectedNpcIds.includes(npcId);
    },
    [selectedNpcIds],
  );

  const toggleSceneNpc = useCallback(
    (npcId: string, eligible: boolean) => {
      if (!eligible || !onNpcSelectionChange) return;
      const currentlyChecked = eligibleSceneNpcs
        .filter((n) => isNpcChecked(n.npcId, true))
        .map((n) => n.npcId);

      let next: string[];
      if (currentlyChecked.includes(npcId)) {
        next = currentlyChecked.filter((id) => id !== npcId);
      } else {
        next = [...currentlyChecked, npcId];
      }

      if (next.length < 1) {
        setError('至少保留一名可出场 NPC');
        return;
      }
      setError(null);

      const allEligibleIds = eligibleSceneNpcs.map((n) => n.npcId);
      const isAll =
        next.length === allEligibleIds.length &&
        allEligibleIds.every((id) => next.includes(id));
      onNpcSelectionChange(isAll ? null : next);
    },
    [eligibleSceneNpcs, isNpcChecked, onNpcSelectionChange],
  );

  if (!open) return null;

  const saveAccount = async () => {
    setSaving(true);
    setError(null);
    try {
      const body: {
        currentPassword: string;
        username?: string;
        newPassword?: string;
      } = {
        currentPassword: accountForm.currentPassword,
      };
      if (accountForm.username.trim() !== (account?.username ?? '')) {
        body.username = accountForm.username.trim();
      }
      if (accountForm.newPassword.trim()) {
        body.newPassword = accountForm.newPassword;
      }
      const session = await apiFetch<AuthSession>('/players/me/account', {
        token,
        method: 'PUT',
        body,
      });
      onSessionUpdate?.(session);
      setAccount((prev) =>
        prev
          ? {
              ...prev,
              username: session.username,
              updatedAt: new Date().toISOString(),
            }
          : prev,
      );
      setAccountForm({
        username: session.username,
        currentPassword: '',
        newPassword: '',
      });
      setEditingAccount(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const editorHref =
    worldId && packVersionId
      ? `/settings?tab=editor&worldId=${encodeURIComponent(worldId)}&versionDir=${encodeURIComponent(packVersionId)}&autoload=1`
      : '/settings?tab=editor';

  const profileFields = packProfile ? resolveProfileFields(packProfile) : [];

  return (
    <div className="absolute inset-0 z-50 flex">
      <button
        type="button"
        className="absolute inset-0"
        style={{ background: 'var(--ui-overlay)' }}
        aria-label="关闭菜单"
        onClick={onClose}
      />
      <aside className="esc-rail" style={{ width }}>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="拖拽调整菜单宽度"
          aria-valuemin={WIDTH_MIN}
          aria-valuemax={WIDTH_MAX}
          aria-valuenow={width}
          onPointerDown={onResizePointerDown}
          className="esc-rail__resize"
        >
          <span className="esc-rail__resize-grip" />
        </div>

        <div className="esc-rail__head">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="esc-rail__eyebrow">OCraft · Menu</p>
            <button
              type="button"
              className="esc-rail__link"
              onClick={() => setEditingAccount((v) => !v)}
            >
              {editingAccount ? '取消' : '编辑账号'}
            </button>
          </div>
          <h2 className="esc-rail__title">
            {account?.username ?? username}
          </h2>
          <p className="esc-rail__meta">
            UID {account?.id ?? '—'}
            {' · '}
            注册{' '}
            {account?.createdAt
              ? new Date(account.createdAt).toLocaleDateString()
              : '—'}
          </p>
          {editingAccount && (
            <div className="mt-3 space-y-2">
              <label className="block text-xs">
                <span style={{ color: 'var(--ui-fg-muted)' }}>用户名</span>
                <input
                  className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm outline-none"
                  style={{
                    background: 'var(--ui-input)',
                    borderColor: 'var(--ui-border)',
                    color: 'var(--ui-fg)',
                  }}
                  value={accountForm.username}
                  onChange={(e) =>
                    setAccountForm((f) => ({ ...f, username: e.target.value }))
                  }
                />
              </label>
              <label className="block text-xs">
                <span style={{ color: 'var(--ui-fg-muted)' }}>当前密码</span>
                <input
                  type="password"
                  className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm outline-none"
                  style={{
                    background: 'var(--ui-input)',
                    borderColor: 'var(--ui-border)',
                    color: 'var(--ui-fg)',
                  }}
                  value={accountForm.currentPassword}
                  onChange={(e) =>
                    setAccountForm((f) => ({
                      ...f,
                      currentPassword: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="block text-xs">
                <span style={{ color: 'var(--ui-fg-muted)' }}>
                  新密码（可选）
                </span>
                <input
                  type="password"
                  className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm outline-none"
                  style={{
                    background: 'var(--ui-input)',
                    borderColor: 'var(--ui-border)',
                    color: 'var(--ui-fg)',
                  }}
                  value={accountForm.newPassword}
                  onChange={(e) =>
                    setAccountForm((f) => ({
                      ...f,
                      newPassword: e.target.value,
                    }))
                  }
                />
              </label>
              <button
                type="button"
                disabled={saving || !accountForm.currentPassword}
                onClick={() => void saveAccount()}
                className="w-full rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
                style={{
                  background: 'var(--ui-accent)',
                  color: 'var(--ui-accent-fg)',
                }}
              >
                {saving ? '保存中…' : '保存账号'}
              </button>
            </div>
          )}
        </div>

        <div className="esc-rail__body">
          {error && (
            <p className="text-xs" style={{ color: 'var(--ui-danger)' }}>
              {error}
            </p>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="esc-rail__section-label" style={{ marginBottom: 0 }}>
                个人信息
              </h3>
              <Link
                href={editorHref}
                className="esc-rail__link"
                onClick={onClose}
              >
                编辑
              </Link>
            </div>
            <dl className="space-y-1.5 text-sm">
              {profileFields.length === 0 && (
                <p className="text-sm" style={{ color: 'var(--ui-fg-muted)' }}>
                  暂无本世界人设
                </p>
              )}
              {profileFields.map((f) => {
                const raw =
                  f.id === 'gender' || f.label === '性别'
                    ? (GENDER_LABEL[f.value] ?? f.value)
                    : f.value;
                const display = raw || '—';
                return (
                  <div key={f.id} className="flex justify-between gap-2">
                    <dt style={{ color: 'var(--ui-fg-muted)' }}>
                      {f.label || '未命名'}
                    </dt>
                    <dd className="max-w-[55%] truncate text-right">{display}</dd>
                  </div>
                );
              })}
            </dl>
            <p className="mt-2 text-sm" style={{ color: 'var(--ui-fg-muted)' }}>
              当前包：{packLabel || '—'}
            </p>
          </section>

          {sceneNpcs.length > 0 && onNpcSelectionChange && (
            <section>
              <h3 className="esc-rail__section-label">本局出场</h3>
              <p
                className="mb-2 text-xs"
                style={{ color: 'var(--ui-fg-muted)' }}
              >
                仅从已满足出场条件的角色中筛选；未解锁者不可强制上场。
              </p>
              <ul className="space-y-1.5">
                {sceneNpcs.map((n) => {
                  const checked = isNpcChecked(n.npcId, n.eligible);
                  return (
                    <li key={n.npcId}>
                      <label
                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm ${
                          n.eligible ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                        }`}
                        style={{
                          borderColor: 'var(--ui-border)',
                          background: 'var(--ui-bg-elevated)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!n.eligible}
                          onChange={() => toggleSceneNpc(n.npcId, n.eligible)}
                          className="accent-sky-500"
                        />
                        <span className="flex-1 truncate">{n.name}</span>
                        {!n.eligible && (
                          <span
                            className="shrink-0 text-xs"
                            style={{ color: 'var(--ui-fg-muted)' }}
                          >
                            未出场
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
              {selectedNpcIds !== null && (
                <button
                  type="button"
                  className="esc-rail__link mt-2"
                  onClick={() => {
                    setError(null);
                    onNpcSelectionChange(null);
                  }}
                >
                  恢复全部可出场
                </button>
              )}
            </section>
          )}

          {onStartNewRun && (
            <section>
              <h3 className="esc-rail__section-label">剧情</h3>
              <StoryProgressMap
                map={storyMap}
                busy={runBusy}
                onOpen={() => onRequestStoryMap?.()}
                onRestart={(opts) => {
                  onStartNewRun(opts);
                }}
              />
            </section>
          )}

          <section>
            <h3 className="esc-rail__section-label">外观</h3>
            <div
              className="flex rounded-lg p-1"
              style={{ background: 'var(--ui-bg-elevated)' }}
            >
              {(
                [
                  ['light', '浅色'],
                  ['dark', '深色'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTheme(id)}
                  className="flex-1 rounded-md px-2 py-2 text-sm font-medium transition"
                  style={
                    theme === id
                      ? {
                          background: 'var(--ui-panel-solid)',
                          color: 'var(--ui-fg)',
                          boxShadow: 'var(--ui-shadow)',
                        }
                      : { color: 'var(--ui-fg-muted)' }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="esc-rail__foot space-y-2">
          {onRequestAutoPlay && (
            <button
              type="button"
              onClick={() => {
                onRequestAutoPlay();
                onClose();
              }}
              className="w-full rounded-lg px-3 py-2 text-sm font-medium"
              style={{
                background: 'var(--ui-accent)',
                color: 'var(--ui-accent-fg)',
              }}
            >
              自动演绎
            </button>
          )}
          {onRequestHistory && (
            <button
              type="button"
              onClick={() => {
                onRequestHistory();
                onClose();
              }}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{
                borderColor: 'var(--ui-border)',
                color: 'var(--ui-fg)',
              }}
            >
              对话记录
            </button>
          )}
          <Link
            href="/settings"
            className="block w-full rounded-lg px-3 py-2 text-center text-sm font-medium"
            style={{
              background: onRequestAutoPlay
                ? 'var(--ui-bg-elevated)'
                : 'var(--ui-accent)',
              color: onRequestAutoPlay
                ? 'var(--ui-fg)'
                : 'var(--ui-accent-fg)',
              border: onRequestAutoPlay
                ? '1px solid var(--ui-border)'
                : undefined,
            }}
            onClick={onClose}
          >
            设置
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{
              borderColor: 'var(--ui-border)',
              color: 'var(--ui-fg-muted)',
            }}
          >
            退出登录
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full text-xs"
            style={{ color: 'var(--ui-fg-muted)' }}
          >
            Esc 关闭
          </button>
        </div>
      </aside>
    </div>
  );
}
