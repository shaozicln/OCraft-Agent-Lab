'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import type {
  AuthSession,
  PackGenerateSectionKey,
  PackGenerateSections,
  PackGenerateStreamEvent,
  PackSelection,
  PackWorldSummary,
  PlayerAccount,
  PlayerPackProfile,
  PlayerProfileField,
  StoryPack,
} from '@ocraft/shared';
import {
  DEFAULT_PACK_GENERATE_SECTIONS,
  PACK_GENERATE_SECTION_LABELS,
  packGenerateSectionKeys,
  profileFieldsToPatch,
  resolveProfileFields,
  storyPackSchema,
} from '@ocraft/shared';
import { AuthGate } from '@/components/ui/AuthGate';
import { PackEditor } from '@/components/pack-editor/PackEditor';
import { apiFetch, apiFetchSse } from '@/lib/api';
import { useTheme } from '@/theme/ThemeProvider';

type Tab = 'appearance' | 'account' | 'packs' | 'editor';

const SECTION_TO_TOC: Partial<Record<PackGenerateSectionKey, string>> = {
  chapters: 'pack-sec-chapters',
  flags: 'pack-sec-flags',
  numeric_tools: 'pack-sec-numeric',
  animation_rules: 'pack-sec-anim',
  endings: 'pack-sec-endings',
  chapter_triggers: 'pack-sec-triggers',
  npc_reply_flags: 'pack-sec-reply-flags',
  prompt_common: 'pack-sec-prompts-common',
  affinity_tiers: 'pack-sec-affinity',
  fatigue_hints: 'pack-sec-fatigue',
  chapter_constraints: 'pack-sec-chapter-c',
  flag_constraints: 'pack-sec-flag-c',
  npcs: 'pack-sec-npcs',
};

type GenToast = {
  id: string;
  kind: 'ok' | 'err';
  title: string;
  detail?: string;
};

function newProfileField(): PlayerProfileField {
  return {
    id: `custom_${Date.now().toString(36)}`,
    label: '',
    value: '',
  };
}

function SettingsInner({
  token,
  username,
  updateSession,
}: {
  token: string;
  username: string;
  updateSession: (session: AuthSession) => void;
}) {
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState<Tab>('packs');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [account, setAccount] = useState<PlayerAccount | null>(null);
  const [accountForm, setAccountForm] = useState({
    username: '',
    currentPassword: '',
    newPassword: '',
  });

  const [worlds, setWorlds] = useState<PackWorldSummary[]>([]);
  const [selection, setSelection] = useState<PackSelection | null>(null);
  const [selectedWorldId, setSelectedWorldId] = useState<string>('');
  const [saveAsName, setSaveAsName] = useState('');
  const [saveAsFrom, setSaveAsFrom] = useState('');
  const [newWorldId, setNewWorldId] = useState('');
  const [newWorldVersion, setNewWorldVersion] = useState('');
  const [newWorldDesc, setNewWorldDesc] = useState('');

  const [editWorldId, setEditWorldId] = useState('');
  const [editVersionDir, setEditVersionDir] = useState('');
  const [packDraft, setPackDraft] = useState<StoryPack | null>(null);
  const [examplePack, setExamplePack] = useState<StoryPack | null>(null);
  const [genPrompt, setGenPrompt] = useState('');
  const [genSections, setGenSections] = useState<PackGenerateSections>(
    () => ({ ...DEFAULT_PACK_GENERATE_SECTIONS }),
  );
  const [genActiveSection, setGenActiveSection] =
    useState<PackGenerateSectionKey | null>(null);
  const [genDoneSections, setGenDoneSections] = useState<
    Set<PackGenerateSectionKey>
  >(() => new Set());
  const [genToasts, setGenToasts] = useState<GenToast[]>([]);
  const [packProfile, setPackProfile] = useState<PlayerPackProfile | null>(null);
  const [profileFields, setProfileFields] = useState<PlayerProfileField[]>([]);
  const [busy, setBusy] = useState(false);
  const [pendingAutoload, setPendingAutoload] = useState(false);

  const currentWorld = useMemo(
    () => worlds.find((w) => w.world_id === selectedWorldId) ?? worlds[0],
    [worlds, selectedWorldId],
  );

  const applyPackProfile = (p: PlayerPackProfile) => {
    setPackProfile(p);
    setProfileFields(resolveProfileFields(p));
  };

  const refreshPacks = useCallback(async () => {
    const [worldsRes, sel] = await Promise.all([
      apiFetch<{ worlds: PackWorldSummary[] }>('/packs/worlds', { token }),
      apiFetch<PackSelection>('/packs/selection', { token }),
    ]);
    setWorlds(worldsRes.worlds);
    setSelection(sel);
    setSelectedWorldId((prev) => prev || sel.world_id || worldsRes.worlds[0]?.world_id || '');
    setEditWorldId((prev) => prev || sel.world_id);
    setEditVersionDir((prev) => prev || sel.pack_version_id);
    setSaveAsFrom((prev) => prev || sel.pack_version_id);

    const official =
      worldsRes.worlds.find((w) =>
        w.versions.some((v) => v.is_official),
      ) ?? worldsRes.worlds[0];
    const officialVer =
      official?.versions.find((v) => v.is_official) ?? official?.versions[0];
    if (official && officialVer) {
      try {
        const ex = await apiFetch<{ pack: StoryPack }>(
          `/packs/worlds/${encodeURIComponent(official.world_id)}/versions/${encodeURIComponent(officialVer.version_dir)}`,
          { token },
        );
        setExamplePack(ex.pack);
      } catch {
        // placeholder 可选
      }
    }
  }, [token]);

  const refreshAccount = useCallback(async () => {
    const a = await apiFetch<PlayerAccount>('/players/me', { token });
    setAccount(a);
    setAccountForm({
      username: a.username,
      currentPassword: '',
      newPassword: '',
    });
  }, [token]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search);
    const t = q.get('tab');
    if (t === 'appearance' || t === 'account' || t === 'packs' || t === 'editor') {
      setTab(t);
    }
    const w = q.get('worldId');
    const v = q.get('versionDir');
    if (w) setEditWorldId(w);
    if (v) setEditVersionDir(v);
    if (q.get('autoload') === '1' && w && v) {
      setPendingAutoload(true);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await Promise.all([refreshPacks(), refreshAccount()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      }
    })();
  }, [refreshPacks, refreshAccount]);

  const loadPackForEdit = useCallback(async () => {
    if (!editWorldId || !editVersionDir) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const [res, profile] = await Promise.all([
        apiFetch<{ pack: StoryPack }>(
          `/packs/worlds/${encodeURIComponent(editWorldId)}/versions/${encodeURIComponent(editVersionDir)}`,
          { token },
        ),
        apiFetch<PlayerPackProfile>(
          `/players/me/pack-profile?${new URLSearchParams({
            worldId: editWorldId,
            packVersionId: editVersionDir,
          })}`,
          { token },
        ),
      ]);
      setPackDraft(res.pack);
      applyPackProfile(profile);
      setMessage(`已加载 ${res.pack.version_dir}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载包失败');
    } finally {
      setBusy(false);
    }
  }, [editWorldId, editVersionDir, token]);

  useEffect(() => {
    if (!pendingAutoload || !editWorldId || !editVersionDir) return;
    setPendingAutoload(false);
    void loadPackForEdit();
  }, [pendingAutoload, editWorldId, editVersionDir, loadPackForEdit]);

  const savePackEdit = async () => {
    if (!editWorldId || !editVersionDir || !packDraft) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const pack: StoryPack = {
        ...packDraft,
        version_dir: editVersionDir,
        header: {
          ...packDraft.header,
          world_id: editWorldId,
        },
      };
      const res = await apiFetch<{
        display_name: string;
        pack: StoryPack;
      }>(
        `/packs/worlds/${encodeURIComponent(editWorldId)}/versions/${encodeURIComponent(editVersionDir)}`,
        { token, method: 'PUT', body: { pack } },
      );
      setPackDraft(res.pack);
      setMessage(`已保存：${res.pack.version_dir}`);
      await refreshPacks();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setBusy(false);
    }
  };

  const pushGenToast = useCallback((toast: Omit<GenToast, 'id'>) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setGenToasts((list) => [...list, { ...toast, id }]);
    if (toast.kind === 'ok') {
      window.setTimeout(() => {
        setGenToasts((list) => list.filter((t) => t.id !== id));
      }, 3200);
    }
  }, []);

  const dismissGenToast = useCallback((id: string) => {
    setGenToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const generatePackDraft = async () => {
    if (!packDraft || !genPrompt.trim()) return;
    const anyChecked = packGenerateSectionKeys.some((k) => genSections[k]);
    if (!anyChecked) {
      pushGenToast({
        kind: 'err',
        title: '无法开始生成',
        detail: '请至少勾选一个生成项目',
      });
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    setGenActiveSection(null);
    setGenDoneSections(new Set());
    let finished = false;
    try {
      await apiFetchSse('/packs/generate-draft/stream', {
        token,
        body: {
          prompt: genPrompt.trim(),
          basePack: packDraft,
          sections: genSections,
        },
        onEvent: (raw) => {
          const ev = raw as PackGenerateStreamEvent;
          if (ev.type === 'section_start') {
            setGenActiveSection(ev.section);
            const toc = SECTION_TO_TOC[ev.section];
            if (toc) {
              document
                .getElementById(toc)
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            return;
          }
          if (ev.type === 'section_done') {
            setGenDoneSections((prev) => new Set(prev).add(ev.section));
            setGenActiveSection(null);
            if (ev.pack) {
              const parsed = storyPackSchema.safeParse(ev.pack);
              if (parsed.success) setPackDraft(parsed.data);
            }
            pushGenToast({
              kind: 'ok',
              title: `${ev.label}已生成完毕`,
            });
            return;
          }
          if (ev.type === 'error') {
            setGenActiveSection(null);
            pushGenToast({
              kind: 'err',
              title: ev.section
                ? `${PACK_GENERATE_SECTION_LABELS[ev.section]}生成失败`
                : '生成失败',
              detail: ev.message,
            });
            setError(ev.message);
            return;
          }
          if (ev.type === 'done') {
            finished = true;
            const parsed = storyPackSchema.safeParse(ev.pack);
            if (parsed.success) setPackDraft(parsed.data);
            if (ev.profileFields) setProfileFields(ev.profileFields);
            setGenActiveSection(null);
            setMessage(
              ev.source === 'mock'
                ? '流式生成完成（MOCK）。请检查后保存并选用。'
                : '流式生成完成。请检查后保存并选用；个人信息需再点保存。',
            );
          }
        },
      });
      if (!finished) {
        // 流结束但无 done（通常已发过 error）
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : '生成草稿失败';
      pushGenToast({ kind: 'err', title: '生成失败', detail });
      setError(detail);
    } finally {
      setBusy(false);
      setGenActiveSection(null);
    }
  };

  const selectVersion = async (worldId: string, versionDir: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const sel = await apiFetch<PackSelection>('/packs/selection', {
        token,
        method: 'PUT',
        body: { worldId, packVersionId: versionDir },
      });
      setSelection(sel);
      setMessage(`已选用：${sel.world_id}/${sel.pack_version_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '选用失败');
    } finally {
      setBusy(false);
    }
  };

  const clearSelection = async () => {
    setBusy(true);
    try {
      const sel = await apiFetch<PackSelection>('/packs/selection', {
        token,
        method: 'DELETE',
      });
      setSelection(sel);
      setMessage('已恢复默认默认包');
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setBusy(false);
    }
  };

  const saveAs = async () => {
    if (!currentWorld || !saveAsName.trim()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await apiFetch<{
        world_id: string;
        version_dir: string;
        version_name: string;
      }>('/packs/save-as', {
        token,
        method: 'POST',
        body: {
          worldId: currentWorld.world_id,
          fromVersionDir: saveAsFrom || undefined,
          versionName: saveAsName.trim(),
          blankContent: true,
        },
      });
      setMessage(`已另存：${res.version_dir}`);
      setSaveAsName('');
      await refreshPacks();
      setEditWorldId(res.world_id);
      setEditVersionDir(res.version_dir);
      setTab('editor');
      setPendingAutoload(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '另存失败');
    } finally {
      setBusy(false);
    }
  };

  const createWorld = async () => {
    if (!newWorldId.trim()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await apiFetch<{
        world_id: string;
        version_dir: string;
        version_name: string;
      }>('/packs/create-world', {
        token,
        method: 'POST',
        body: {
          worldId: newWorldId.trim(),
          versionName: newWorldVersion.trim() || undefined,
          description: newWorldDesc.trim() || undefined,
        },
      });
      setMessage(`已新建世界：${res.world_id} / ${res.version_dir}`);
      setNewWorldId('');
      setNewWorldVersion('');
      setNewWorldDesc('');
      await refreshPacks();
      setSelectedWorldId(res.world_id);
      setEditWorldId(res.world_id);
      setEditVersionDir(res.version_dir);
      setTab('editor');
      setPendingAutoload(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '新建世界失败');
    } finally {
      setBusy(false);
    }
  };

  const deleteVersion = async (worldId: string, versionDir: string) => {
    if (!confirm(`删除版本 ${worldId}/${versionDir}？不可恢复。`)) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/packs/worlds/${encodeURIComponent(worldId)}/versions/${encodeURIComponent(versionDir)}`, {
        token,
        method: 'DELETE',
      });
      setMessage(`已删除版本 ${versionDir}`);
      if (editWorldId === worldId && editVersionDir === versionDir) {
        setPackDraft(null);
        setEditVersionDir('');
      }
      await refreshPacks();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除版本失败');
    } finally {
      setBusy(false);
    }
  };

  const deleteWorld = async (worldId: string) => {
    if (!confirm(`删除整个世界 ${worldId}（含全部版本）？不可恢复。`)) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/packs/worlds/${encodeURIComponent(worldId)}`, {
        token,
        method: 'DELETE',
      });
      setMessage(`已删除世界 ${worldId}`);
      if (editWorldId === worldId) {
        setPackDraft(null);
        setEditWorldId('');
        setEditVersionDir('');
      }
      await refreshPacks();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除世界失败');
    } finally {
      setBusy(false);
    }
  };

  const saveAccount = async () => {
    setBusy(true);
    setError(null);
    try {
      const body: {
        currentPassword: string;
        username?: string;
        newPassword?: string;
      } = { currentPassword: accountForm.currentPassword };
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
      updateSession(session);
      await refreshAccount();
      setMessage('账号已更新');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setBusy(false);
    }
  };

  const savePackProfile = async () => {
    if (!editWorldId || !editVersionDir) return;
    setBusy(true);
    setError(null);
    try {
      const cleaned = profileFields.map((f, i) => ({
        id: f.id.trim() || `field_${i}`,
        label: f.label.trim() || `字段${i + 1}`,
        value: f.value,
      }));
      const patch = profileFieldsToPatch(cleaned);
      const p = await apiFetch<PlayerPackProfile>('/players/me/pack-profile', {
        token,
        method: 'PUT',
        body: {
          worldId: editWorldId,
          packVersionId: editVersionDir,
          ...patch,
        },
      });
      applyPackProfile(p);
      setMessage('本世界个人信息已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存人设失败');
    } finally {
      setBusy(false);
    }
  };

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'appearance', label: '外观' },
    { id: 'account', label: '账号' },
    { id: 'packs', label: '剧情包' },
    { id: 'editor', label: '编辑 Pack' },
  ];

  const panelStyle: CSSProperties = {
    background: 'var(--ui-panel-solid)',
    borderColor: 'var(--ui-border)',
    color: 'var(--ui-fg)',
    boxShadow: 'var(--ui-shadow)',
  };

  return (
    <main
      className="min-h-screen"
      style={{ background: 'var(--ui-bg)', color: 'var(--ui-fg)' }}
    >
      <header
        className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 backdrop-blur"
        style={{
          background: 'var(--ui-panel)',
          borderColor: 'var(--ui-border)',
        }}
      >
        <div>
          <h1 className="text-lg font-semibold">设置</h1>
          <p className="text-xs" style={{ color: 'var(--ui-fg-muted)' }}>
            {username}
            {selection
              ? ` · ${selection.world_id}/${selection.pack_version_id}`
              : ''}
            {selection && !selection.is_explicit ? '（测试默认）' : ''}
          </p>
        </div>
        <Link
          href="/"
          className="rounded-lg px-3 py-1.5 text-sm font-medium"
          style={{
            background: 'var(--ui-accent)',
            color: 'var(--ui-accent-fg)',
          }}
        >
          返回游戏
        </Link>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <nav className="w-40 shrink-0 space-y-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="w-full rounded-lg px-3 py-2 text-left text-sm"
              style={
                tab === t.id
                  ? {
                      background: 'var(--ui-accent)',
                      color: 'var(--ui-accent-fg)',
                    }
                  : { color: 'var(--ui-fg-muted)' }
              }
            >
              {t.label}
            </button>
          ))}
        </nav>

        <section className="min-w-0 flex-1 space-y-4">
          {(error || message) && (
            <div
              className="rounded-xl border px-4 py-3 text-sm"
              style={{
                ...panelStyle,
                borderColor: error ? 'var(--ui-danger)' : 'var(--ui-border)',
                color: error ? 'var(--ui-danger)' : 'var(--ui-fg)',
              }}
            >
              {error ?? message}
            </div>
          )}

          {tab === 'appearance' && (
            <div className="rounded-2xl border p-5" style={panelStyle}>
              <h2 className="text-base font-semibold">外观主题</h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--ui-fg-muted)' }}>
                浅色为白/半透明白；深色为蓝黑/半透明蓝黑（原控制台风格）。
              </p>
              <div
                className="mt-4 flex max-w-sm rounded-xl p-1"
                style={{ background: 'var(--ui-bg)' }}
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
                    className="flex-1 rounded-lg px-3 py-2 text-sm font-medium"
                    style={
                      theme === id
                        ? {
                            background: 'var(--ui-panel-solid)',
                            boxShadow: 'var(--ui-shadow)',
                          }
                        : { color: 'var(--ui-fg-muted)' }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'account' && (
            <div className="rounded-2xl border p-5" style={panelStyle}>
              <h2 className="text-base font-semibold">账号</h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--ui-fg-muted)' }}>
                UID、用户名、密码为全局账号信息，与剧情包无关。
              </p>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between gap-2">
                  <dt style={{ color: 'var(--ui-fg-muted)' }}>UID</dt>
                  <dd className="font-mono">{account?.id ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt style={{ color: 'var(--ui-fg-muted)' }}>注册日期</dt>
                  <dd>
                    {account?.createdAt
                      ? new Date(account.createdAt).toLocaleString()
                      : '—'}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  <span style={{ color: 'var(--ui-fg-muted)' }}>用户名</span>
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 outline-none"
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
                <label className="block text-sm">
                  <span style={{ color: 'var(--ui-fg-muted)' }}>当前密码</span>
                  <input
                    type="password"
                    className="mt-1 w-full rounded-lg border px-3 py-2 outline-none"
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
                <label className="block text-sm">
                  <span style={{ color: 'var(--ui-fg-muted)' }}>新密码（可选）</span>
                  <input
                    type="password"
                    className="mt-1 w-full rounded-lg border px-3 py-2 outline-none"
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
              </div>
              <button
                type="button"
                disabled={busy || !accountForm.currentPassword}
                onClick={() => void saveAccount()}
                className="mt-4 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                style={{
                  background: 'var(--ui-accent)',
                  color: 'var(--ui-accent-fg)',
                }}
              >
                保存账号
              </button>
            </div>
          )}

          {tab === 'packs' && (
            <div className="space-y-4">
              <div className="rounded-2xl border p-5" style={panelStyle}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold">世界与版本</h2>
                  <button
                    type="button"
                    className="text-sm"
                    style={{ color: 'var(--ui-accent)' }}
                    onClick={() => void clearSelection()}
                  >
                    恢复默认默认
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {worlds.map((w) => (
                    <button
                      key={w.world_id}
                      type="button"
                      onClick={() => setSelectedWorldId(w.world_id)}
                      className="rounded-lg border px-3 py-1.5 font-mono text-sm"
                      style={
                        currentWorld?.world_id === w.world_id
                          ? {
                              background: 'var(--ui-accent)',
                              color: 'var(--ui-accent-fg)',
                              borderColor: 'transparent',
                            }
                          : {
                              borderColor: 'var(--ui-border)',
                              color: 'var(--ui-fg)',
                            }
                      }
                    >
                      {w.world_id}
                    </button>
                  ))}
                  {currentWorld && currentWorld.world_id !== 'office' && (
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-lg border px-3 py-1.5 text-xs"
                      style={{
                        borderColor: 'var(--ui-border)',
                        color: 'var(--ui-danger)',
                      }}
                      onClick={() => void deleteWorld(currentWorld.world_id)}
                    >
                      删除世界
                    </button>
                  )}
                </div>
                {currentWorld && (
                  <ul className="mt-4 space-y-2">
                    {currentWorld.versions.map((v) => (
                      <li
                        key={v.version_dir}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2"
                        style={{ borderColor: 'var(--ui-border)' }}
                      >
                        <div>
                          <p className="font-mono text-sm font-medium">
                            {v.version_dir}
                          </p>
                          <p
                            className="text-xs"
                            style={{ color: 'var(--ui-fg-muted)' }}
                          >
                            {v.created_at}
                            {v.is_official ? ' · 测试默认' : ''}
                            {selection?.world_id === v.world_id &&
                            selection?.pack_version_id === v.version_dir
                              ? ' · 当前选用'
                              : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            className="rounded-lg border px-3 py-1.5 text-xs"
                            style={{ borderColor: 'var(--ui-border)' }}
                            onClick={() => {
                              setEditWorldId(v.world_id);
                              setEditVersionDir(v.version_dir);
                              setTab('editor');
                            }}
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium"
                            style={{
                              background: 'var(--ui-accent)',
                              color: 'var(--ui-accent-fg)',
                            }}
                            onClick={() =>
                              void selectVersion(v.world_id, v.version_dir)
                            }
                          >
                            选用
                          </button>
                          {!v.is_official && (
                            <button
                              type="button"
                              disabled={busy}
                              className="rounded-lg border px-3 py-1.5 text-xs"
                              style={{
                                borderColor: 'var(--ui-border)',
                                color: 'var(--ui-danger)',
                              }}
                              onClick={() =>
                                void deleteVersion(v.world_id, v.version_dir)
                              }
                            >
                              删除
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-2xl border p-5" style={panelStyle}>
                <h2 className="text-base font-semibold">另存为新版本</h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--ui-fg-muted)' }}>
                  只填版本名 → 生成「版本名__时间戳」文件夹；内容清空，测试示例作浅灰提示。
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span style={{ color: 'var(--ui-fg-muted)' }}>版本名</span>
                    <input
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                      style={{
                        background: 'var(--ui-input)',
                        borderColor: 'var(--ui-border)',
                        color: 'var(--ui-fg)',
                      }}
                      value={saveAsName}
                      onChange={(e) => setSaveAsName(e.target.value)}
                      placeholder="例如 my_v2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span style={{ color: 'var(--ui-fg-muted)' }}>源版本</span>
                    <select
                      className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm"
                      style={{
                        background: 'var(--ui-input)',
                        borderColor: 'var(--ui-border)',
                        color: 'var(--ui-fg)',
                      }}
                      value={saveAsFrom}
                      onChange={(e) => setSaveAsFrom(e.target.value)}
                    >
                      {(currentWorld?.versions ?? []).map((v) => (
                        <option key={v.version_dir} value={v.version_dir}>
                          {v.version_dir}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  disabled={busy || !saveAsName.trim()}
                  onClick={() => void saveAs()}
                  className="mt-4 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                  style={{
                    background: 'var(--ui-accent)',
                    color: 'var(--ui-accent-fg)',
                  }}
                >
                  另存并编辑
                </button>
              </div>

              <div className="rounded-2xl border p-5" style={panelStyle}>
                <h2 className="text-base font-semibold">新建世界</h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--ui-fg-muted)' }}>
                  世界 ID = story-packs/ 文件夹名；首版版本名可省略（默认等于世界 ID）。
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span style={{ color: 'var(--ui-fg-muted)' }}>
                      世界 ID（文件夹名）
                    </span>
                    <input
                      className="mt-1 w-full rounded-lg border px-3 py-2 font-mono"
                      style={{
                        background: 'var(--ui-input)',
                        borderColor: 'var(--ui-border)',
                        color: 'var(--ui-fg)',
                      }}
                      value={newWorldId}
                      onChange={(e) => setNewWorldId(e.target.value)}
                      placeholder="例如 awaken"
                    />
                  </label>
                  <label className="block text-sm">
                    <span style={{ color: 'var(--ui-fg-muted)' }}>
                      首版版本名（可选）
                    </span>
                    <input
                      className="mt-1 w-full rounded-lg border px-3 py-2 font-mono"
                      style={{
                        background: 'var(--ui-input)',
                        borderColor: 'var(--ui-border)',
                        color: 'var(--ui-fg)',
                      }}
                      value={newWorldVersion}
                      onChange={(e) => setNewWorldVersion(e.target.value)}
                      placeholder="默认 = 世界 ID"
                    />
                  </label>
                  <label className="block text-sm sm:col-span-2">
                    <span style={{ color: 'var(--ui-fg-muted)' }}>简介（可选）</span>
                    <input
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                      style={{
                        background: 'var(--ui-input)',
                        borderColor: 'var(--ui-border)',
                        color: 'var(--ui-fg)',
                      }}
                      value={newWorldDesc}
                      onChange={(e) => setNewWorldDesc(e.target.value)}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  disabled={busy || !newWorldId.trim()}
                  onClick={() => void createWorld()}
                  className="mt-4 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                  style={{
                    background: 'var(--ui-accent)',
                    color: 'var(--ui-accent-fg)',
                  }}
                >
                  新建并编辑
                </button>
              </div>
            </div>
          )}

          {tab === 'editor' && (
            <div className="space-y-4">
              <div className="rounded-2xl border p-5" style={panelStyle}>
                <h2 className="text-base font-semibold">编辑 Pack</h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--ui-fg-muted)' }}>
                  设定按版本隔离；新建/另存后字段为空，浅灰 placeholder 来自测试包。
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span style={{ color: 'var(--ui-fg-muted)' }}>
                      世界
                    </span>
                    <select
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                      style={{
                        background: 'var(--ui-input)',
                        borderColor: 'var(--ui-border)',
                        color: 'var(--ui-fg)',
                      }}
                      value={editWorldId}
                      onChange={(e) => {
                        setEditWorldId(e.target.value);
                        const w = worlds.find((x) => x.world_id === e.target.value);
                        setEditVersionDir(w?.versions[0]?.version_dir ?? '');
                      }}
                    >
                      {worlds.map((w) => (
                        <option key={w.world_id} value={w.world_id}>
                          {w.world_id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span style={{ color: 'var(--ui-fg-muted)' }}>版本</span>
                    <select
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                      style={{
                        background: 'var(--ui-input)',
                        borderColor: 'var(--ui-border)',
                        color: 'var(--ui-fg)',
                      }}
                      value={editVersionDir}
                      onChange={(e) => setEditVersionDir(e.target.value)}
                    >
                      {(
                        worlds.find((w) => w.world_id === editWorldId)?.versions ??
                        []
                      ).map((v) => (
                        <option key={v.version_dir} value={v.version_dir}>
                          {v.version_dir}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void loadPackForEdit()}
                    className="rounded-lg border px-4 py-2 text-sm"
                    style={{ borderColor: 'var(--ui-border)' }}
                  >
                    加载
                  </button>
                  <button
                    type="button"
                    disabled={busy || !packDraft}
                    onClick={() => void savePackEdit()}
                    className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                    style={{
                      background: 'var(--ui-accent)',
                      color: 'var(--ui-accent-fg)',
                    }}
                  >
                    保存到磁盘
                  </button>
                </div>
              </div>

              {packDraft && (
                <div className="rounded-2xl border p-5" style={panelStyle}>
                  <h2 className="text-base font-semibold">一句话生成草稿</h2>
                  <p
                    className="mt-1 text-sm"
                    style={{ color: 'var(--ui-fg-muted)' }}
                  >
                    勾选要生成的目录项；未勾选保留当前内容。按块串行生成（真进度）：黄底=正在生成，绿底=已完成。失败会弹窗说明原因。本世界个人信息只填表单，需再保存。
                  </p>
                  <textarea
                    className="mt-3 min-h-[4.5rem] w-full rounded-lg border px-3 py-2 text-sm outline-none placeholder:text-[color:var(--ui-fg-muted)]"
                    style={{
                      background: 'var(--ui-input)',
                      borderColor: 'var(--ui-border)',
                      color: 'var(--ui-fg)',
                    }}
                    value={genPrompt}
                    onChange={(e) => setGenPrompt(e.target.value)}
                    placeholder="例：咖啡店店员发现自己是被写入程序的 NPC，两章后崩溃想逃出店门"
                  />
                  <div className="mt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-medium">配置生成项目</h3>
                      <div className="flex gap-2 text-xs">
                        <button
                          type="button"
                          className="underline"
                          style={{ color: 'var(--ui-accent)' }}
                          onClick={() =>
                            setGenSections({ ...DEFAULT_PACK_GENERATE_SECTIONS })
                          }
                        >
                          全选
                        </button>
                        <button
                          type="button"
                          className="underline"
                          style={{ color: 'var(--ui-fg-muted)' }}
                          onClick={() =>
                            setGenSections(
                              Object.fromEntries(
                                packGenerateSectionKeys.map((k) => [k, false]),
                              ) as PackGenerateSections,
                            )
                          }
                        >
                          全不选
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {packGenerateSectionKeys.map((key) => {
                        const active = genActiveSection === key;
                        const done = genDoneSections.has(key);
                        return (
                          <label
                            key={key}
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors"
                            style={{
                              background: active
                                ? 'rgba(250, 204, 21, 0.55)'
                                : done
                                  ? 'rgba(34, 197, 94, 0.15)'
                                  : undefined,
                              outline: active
                                ? '1px solid rgba(202, 138, 4, 0.8)'
                                : undefined,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={genSections[key]}
                              disabled={busy}
                              onChange={(e) =>
                                setGenSections((s) => ({
                                  ...s,
                                  [key]: e.target.checked,
                                }))
                              }
                            />
                            <span>
                              {PACK_GENERATE_SECTION_LABELS[key]}
                              {active ? ' · 生成中' : done ? ' · 完成' : ''}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy || !genPrompt.trim()}
                    onClick={() => void generatePackDraft()}
                    className="mt-3 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                    style={{
                      background: 'var(--ui-accent)',
                      color: 'var(--ui-accent-fg)',
                    }}
                  >
                    {busy
                      ? genActiveSection
                        ? `正在生成：${PACK_GENERATE_SECTION_LABELS[genActiveSection]}…`
                        : '生成中…'
                      : '生成草稿'}
                  </button>
                </div>
              )}

              {packDraft && (
                <div className="rounded-2xl border p-5" style={panelStyle}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-base font-semibold">本世界个人信息</h2>
                      
                    </div>
                    <button
                      type="button"
                      className="rounded-lg border px-3 py-1.5 text-xs"
                      style={{
                        borderColor: 'var(--ui-border)',
                        color: 'var(--ui-accent)',
                      }}
                      onClick={() =>
                        setProfileFields((fs) => [...fs, newProfileField()])
                      }
                    >
                      + 字段
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {profileFields.map((field, i) => (
                      <div
                        key={field.id}
                        className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[8rem_1fr_auto]"
                        style={{ borderColor: 'var(--ui-border)' }}
                      >
                        <label className="block text-sm">
                          <span style={{ color: 'var(--ui-fg-muted)' }}>
                            项名
                          </span>
                          <input
                            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none placeholder:text-[color:var(--ui-fg-muted)]"
                            style={{
                              background: 'var(--ui-input)',
                              borderColor: 'var(--ui-border)',
                              color: 'var(--ui-fg)',
                            }}
                            value={field.label}
                            placeholder="如：岗位"
                            onChange={(e) =>
                              setProfileFields((fs) =>
                                fs.map((f, j) =>
                                  j === i
                                    ? { ...f, label: e.target.value }
                                    : f,
                                ),
                              )
                            }
                          />
                        </label>
                        <label className="block text-sm">
                          <span style={{ color: 'var(--ui-fg-muted)' }}>
                            内容
                          </span>
                          <input
                            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none placeholder:text-[color:var(--ui-fg-muted)]"
                            style={{
                              background: 'var(--ui-input)',
                              borderColor: 'var(--ui-border)',
                              color: 'var(--ui-fg)',
                            }}
                            value={field.value}
                            placeholder="填写本项内容"
                            onChange={(e) =>
                              setProfileFields((fs) =>
                                fs.map((f, j) =>
                                  j === i
                                    ? { ...f, value: e.target.value }
                                    : f,
                                ),
                              )
                            }
                          />
                        </label>
                        <button
                          type="button"
                          className="self-end pb-2 text-xs"
                          style={{ color: 'var(--ui-danger)' }}
                          onClick={() =>
                            setProfileFields((fs) =>
                              fs.filter((_, j) => j !== i),
                            )
                          }
                        >
                          删除
                        </button>
                      </div>
                    ))}
                    {profileFields.length === 0 && (
                      <p
                        className="text-sm"
                        style={{ color: 'var(--ui-fg-muted)' }}
                      >
                        暂无字段，点「+ 字段」添加。
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void savePackProfile()}
                    className="mt-4 rounded-lg px-4 py-2 text-sm font-medium"
                    style={{
                      background: 'var(--ui-accent)',
                      color: 'var(--ui-accent-fg)',
                    }}
                  >
                    保存本世界个人信息
                  </button>
                  {packProfile &&
                    packProfile.updatedAt !== new Date(0).toISOString() && (
                      <p
                        className="mt-2 text-xs"
                        style={{ color: 'var(--ui-fg-muted)' }}
                      >
                        更新于{' '}
                        {new Date(packProfile.updatedAt).toLocaleString()}
                      </p>
                    )}
                </div>
              )}

              {packDraft && (
                <PackEditor
                  value={packDraft}
                  onChange={setPackDraft}
                  example={examplePack}
                  panelStyle={panelStyle}
                  highlightTocId={
                    genActiveSection
                      ? SECTION_TO_TOC[genActiveSection] ?? null
                      : null
                  }
                />
              )}
            </div>
          )}
        </section>
      </div>

      {genToasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
          {genToasts.map((t) => (
            <div
              key={t.id}
              role="alert"
              className="rounded-xl border px-4 py-3 shadow-lg"
              style={{
                background: 'var(--ui-panel, #fff)',
                borderColor:
                  t.kind === 'err'
                    ? 'var(--ui-danger, #dc2626)'
                    : 'rgba(202, 138, 4, 0.7)',
                color: 'var(--ui-fg)',
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">{t.title}</p>
                <button
                  type="button"
                  className="text-xs opacity-70 hover:opacity-100"
                  onClick={() => dismissGenToast(t.id)}
                >
                  关闭
                </button>
              </div>
              {t.detail && (
                <p
                  className="mt-1 text-xs leading-relaxed"
                  style={{ color: 'var(--ui-fg-muted)' }}
                >
                  {t.detail}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

export default function SettingsPage() {
  return (
    <AuthGate>
      {({ token, username, updateSession }) => (
        <SettingsInner
          token={token}
          username={username}
          updateSession={updateSession}
        />
      )}
    </AuthGate>
  );
}
