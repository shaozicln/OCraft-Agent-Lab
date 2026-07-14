'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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

const GENDER_LABEL: Record<string, string> = {
  male: '男',
  female: '女',
  other: '其他',
  undisclosed: '未透露',
};

interface EscMenuProps {
  open: boolean;
  token: string;
  username: string;
  packLabel?: string;
  worldId?: string;
  packVersionId?: string;
  storyMap?: StoryMapEvent | null;
  runBusy?: boolean;
  onClose: () => void;
  onLogout: () => void;
  onSessionUpdate?: (session: AuthSession) => void;
  onRequestStoryMap?: () => void;
  onStartNewRun?: (opts: {
    chapterId?: string;
    viaRuleId?: string;
    displayName?: string;
  }) => void;
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
  onClose,
  onLogout,
  onSessionUpdate,
  onRequestStoryMap,
  onStartNewRun,
}: EscMenuProps) {
  const { theme, setTheme } = useTheme();
  const [account, setAccount] = useState<PlayerAccount | null>(null);
  const [packProfile, setPackProfile] = useState<PlayerPackProfile | null>(null);
  const [editingAccount, setEditingAccount] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState({
    username: '',
    currentPassword: '',
    newPassword: '',
  });

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
      <aside
        className="relative z-10 flex h-full w-[min(25vw,20rem)] min-w-[16rem] flex-col border-r shadow-lg backdrop-blur-md"
        style={{
          background: 'var(--ui-panel)',
          borderColor: 'var(--ui-border)',
          color: 'var(--ui-fg)',
          boxShadow: 'var(--ui-shadow)',
        }}
      >
        <div
          className="border-b px-4 py-3"
          style={{ borderColor: 'var(--ui-border)' }}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-xs" style={{ color: 'var(--ui-fg-muted)' }}>
              菜单
            </p>
            <button
              type="button"
              className="text-xs"
              style={{ color: 'var(--ui-accent)' }}
              onClick={() => setEditingAccount((v) => !v)}
            >
              {editingAccount ? '取消' : '编辑账号'}
            </button>
          </div>
          <h2 className="text-base font-semibold">
            {account?.username ?? username}
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--ui-fg-muted)' }}>
            UID {account?.id ?? '—'}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--ui-fg-muted)' }}>
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

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
          {error && (
            <p className="text-xs" style={{ color: 'var(--ui-danger)' }}>
              {error}
            </p>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-medium">个人信息</h3>
              <Link
                href={editorHref}
                className="text-xs"
                style={{ color: 'var(--ui-accent)' }}
                onClick={onClose}
              >
                编辑
              </Link>
            </div>
            <dl className="space-y-1 text-xs">
              {profileFields.length === 0 && (
                <p style={{ color: 'var(--ui-fg-muted)' }}>暂无本世界人设</p>
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
                    <dd className="max-w-[9rem] truncate text-right">
                      {display}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <p className="mt-2 text-xs" style={{ color: 'var(--ui-fg-muted)' }}>
              当前包：{packLabel || '—'}
            </p>
          </section>

          {onStartNewRun && (
            <section>
              <h3 className="mb-2 font-medium">剧情</h3>
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
            <h3 className="mb-2 font-medium">外观</h3>
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
                  className="flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition"
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

        <div
          className="space-y-2 border-t px-4 py-3"
          style={{ borderColor: 'var(--ui-border)' }}
        >
          <Link
            href="/settings"
            className="block w-full rounded-lg px-3 py-2 text-center text-sm font-medium"
            style={{
              background: 'var(--ui-accent)',
              color: 'var(--ui-accent-fg)',
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
