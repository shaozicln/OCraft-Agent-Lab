'use client';

import Link from 'next/link';
import { Literata } from 'next/font/google';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import type {
  AgentTraceRecord,
  AuthSession,
  PackClarifyAnswer,
  PackClarifySession,
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
  PACK_GENERATE_OUTLINE_MAX,
  PACK_GENERATE_PROMPT_MAX,
  PACK_GENERATE_SECTION_LABELS,
  packGenerateSectionKeys,
  profileFieldsToPatch,
  resolveProfileFields,
  storyPackSchema,
} from '@ocraft/shared';
import { AuthGate } from '@/components/ui/AuthGate';
import { PackEditor } from '@/components/pack-editor/PackEditor';
import { PackClarifyModal } from '@/components/pack-editor/PackClarifyModal';
import { apiFetch, apiFetchSse } from '@/lib/api';
import {
  getLabPeerAgentsEnabled,
  setLabPeerAgentsEnabled,
} from '@/lib/lab-settings';
import { useTheme } from '@/theme/ThemeProvider';
import './settings.css';

/** 题头拉丁：Literata 书刊感，字面更宽、更舒展 */
const settingsDisplay = Literata({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-settings-display',
  display: 'swap',
});

type Tab = 'appearance' | 'account' | 'packs' | 'editor' | 'traces' | 'lab';

const SECTION_TO_TOC: Partial<Record<PackGenerateSectionKey, string>> = {
  chapters: 'pack-sec-chapters',
  flags: 'pack-sec-flags',
  npcs: 'pack-sec-npcs',
  endings: 'pack-sec-endings',
  numeric_tools: 'pack-sec-numeric',
  animation_rules: 'pack-sec-anim',
  chapter_triggers: 'pack-sec-triggers',
  npc_reply_flags: 'pack-sec-reply-flags',
  prompt_common: 'pack-sec-prompts-common',
  affinity_tiers: 'pack-sec-affinity',
  fatigue_hints: 'pack-sec-fatigue',
  chapter_constraints: 'pack-sec-chapter-c',
  flag_constraints: 'pack-sec-flag-c',
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
  const [genOutline, setGenOutline] = useState('');
  const [showOutlineImport, setShowOutlineImport] = useState(false);
  const [genSections, setGenSections] = useState<PackGenerateSections>(
    () => ({ ...DEFAULT_PACK_GENERATE_SECTIONS }),
  );
  const [genActiveSection, setGenActiveSection] =
    useState<PackGenerateSectionKey | null>(null);
  const [genDoneSections, setGenDoneSections] = useState<
    Set<PackGenerateSectionKey>
  >(() => new Set());
  const [genFailedSections, setGenFailedSections] = useState<
    Set<PackGenerateSectionKey>
  >(() => new Set());
  const [genToasts, setGenToasts] = useState<GenToast[]>([]);
  const [packProfile, setPackProfile] = useState<PlayerPackProfile | null>(null);
  const [profileFields, setProfileFields] = useState<PlayerProfileField[]>([]);
  const [busy, setBusy] = useState(false);
  const [pendingAutoload, setPendingAutoload] = useState(false);
  const [traces, setTraces] = useState<AgentTraceRecord[]>([]);
  const [tracesBusy, setTracesBusy] = useState(false);
  const [labPeerAgents, setLabPeerAgents] = useState(false);
  const [labRiskAck, setLabRiskAck] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [headerExpandClick, setHeaderExpandClick] = useState(false);
  const [clarifyOpen, setClarifyOpen] = useState(false);
  const [clarifyBusy, setClarifyBusy] = useState(false);
  const [clarifySession, setClarifySession] =
    useState<PackClarifySession | null>(null);
  const [clarifyError, setClarifyError] = useState<string | null>(null);
  const [clarifyPendingAction, setClarifyPendingAction] = useState<
    'save' | 'review' | null
  >(null);
  const [clarifySatisfied, setClarifySatisfied] = useState(false);
  /** 点击展开时的 scrollY；只有再往下滚超过阈值才收起，避免展开动画触发的 scroll 立刻清掉状态 */
  const headerPinYRef = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 36) {
        setHeaderScrolled(false);
        setHeaderExpandClick(false);
        return;
      }
      if (y > 80) {
        setHeaderScrolled(true);
        setHeaderExpandClick((pinned) => {
          if (!pinned) return false;
          if (y > headerPinYRef.current + 56) return false;
          return true;
        });
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const headerCollapsed = headerScrolled && !headerExpandClick;

  const expandSettingsHeader = useCallback(() => {
    headerPinYRef.current = window.scrollY;
    setHeaderExpandClick(true);
  }, []);

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
    setLabPeerAgents(getLabPeerAgentsEnabled());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search);
    const t = q.get('tab');
    if (
      t === 'appearance' ||
      t === 'account' ||
      t === 'packs' ||
      t === 'editor' ||
      t === 'traces' ||
      t === 'lab'
    ) {
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
      setClarifySatisfied(false);
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

  const performSavePack = useCallback(
    async (draft: StoryPack) => {
      if (!editWorldId || !editVersionDir) return;
      setBusy(true);
      setError(null);
      setMessage(null);
      try {
        const pack: StoryPack = {
          ...draft,
          version_dir: editVersionDir,
          header: {
            ...draft.header,
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
    },
    [editWorldId, editVersionDir, token, refreshPacks],
  );

  const openClarify = useCallback(
    async (pack: StoryPack, pending: 'save' | 'review') => {
      setClarifyOpen(true);
      setClarifyBusy(true);
      setClarifyError(null);
      setClarifySession(null);
      setClarifyPendingAction(pending);
      try {
        const session = await apiFetch<PackClarifySession>(
          '/packs/clarify/start',
          {
            token,
            method: 'POST',
            body: {
              pack,
              prompt: genPrompt.trim() || undefined,
              outline: genOutline.trim() || undefined,
            },
          },
        );
        setClarifySession(session);
      } catch (err) {
        setClarifyError(
          err instanceof Error ? err.message : '澄清问题生成失败',
        );
      } finally {
        setClarifyBusy(false);
      }
    },
    [token, genPrompt, genOutline],
  );

  const requestSavePack = async () => {
    if (!packDraft) return;
    if (clarifySatisfied) {
      await performSavePack(packDraft);
      return;
    }
    await openClarify(packDraft, 'save');
  };

  const applyClarifyAnswers = async (
    answers: PackClarifyAnswer[],
    skipRemaining: boolean,
  ) => {
    if (!packDraft || !clarifySession) return;
    setClarifyBusy(true);
    setClarifyError(null);
    try {
      const res = await apiFetch<{
        pack: StoryPack;
        patch_notes: string[];
        applied?: boolean;
        applied_summary?: string;
      }>('/packs/clarify/apply', {
        token,
        method: 'POST',
        body: {
          pack: packDraft,
          questions: clarifySession.questions,
          answers,
          skip_remaining: skipRemaining,
        },
      });
      const parsed = storyPackSchema.safeParse(res.pack);
      if (!parsed.success) {
        throw new Error('澄清写回后 Pack 校验失败');
      }
      setPackDraft(parsed.data);
      setClarifySatisfied(true);
      setClarifyOpen(false);

      const summary =
        res.applied_summary ??
        (res.patch_notes.length > 0
          ? `已写入草稿 ${res.patch_notes.length} 处`
          : '没有写入改动');
      pushGenToast({
        kind: 'ok',
        title:
          res.patch_notes.length > 0
            ? '澄清已写入草稿'
            : '澄清未改动草稿',
        detail: summary,
      });
      setMessage(summary);

      if (clarifyPendingAction === 'save') {
        await performSavePack(parsed.data);
      }
      setClarifyPendingAction(null);
    } catch (err) {
      setClarifyError(err instanceof Error ? err.message : '澄清应用失败');
    } finally {
      setClarifyBusy(false);
    }
  };

  const savePackEdit = async () => {
    await requestSavePack();
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

  const refreshTraces = useCallback(async () => {
    setTracesBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ traces: AgentTraceRecord[] }>(
        '/agent/traces?limit=40',
        { token },
      );
      setTraces(res.traces);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载 Trace 失败');
    } finally {
      setTracesBusy(false);
    }
  }, [token]);

  const clearTraces = async () => {
    setTracesBusy(true);
    setError(null);
    try {
      await apiFetch<{ removed: number }>('/agent/traces', {
        token,
        method: 'DELETE',
      });
      setTraces([]);
      setMessage('已清空本账号内存中的 Trace');
    } catch (err) {
      setError(err instanceof Error ? err.message : '清空失败');
    } finally {
      setTracesBusy(false);
    }
  };

  useEffect(() => {
    if (tab === 'traces') {
      void refreshTraces();
    }
  }, [tab, refreshTraces]);

  const generatePackDraft = async () => {
    if (!packDraft) return;
    const prompt = genPrompt.trim();
    const outline = genOutline.trim();
    if (prompt.length < 4 && outline.length < 4) {
      pushGenToast({
        kind: 'err',
        title: '无法开始生成',
        detail: '请填写至少 4 字的梗概/摘要，或导入大纲全文',
      });
      return;
    }
    if (prompt.length > PACK_GENERATE_PROMPT_MAX) {
      pushGenToast({
        kind: 'err',
        title: '摘要过长',
        detail: `梗概/摘要最多 ${PACK_GENERATE_PROMPT_MAX} 字`,
      });
      return;
    }
    if (outline.length > PACK_GENERATE_OUTLINE_MAX) {
      pushGenToast({
        kind: 'err',
        title: '大纲过长',
        detail: `导入大纲最多 ${PACK_GENERATE_OUTLINE_MAX} 字`,
      });
      return;
    }
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
    setGenFailedSections(new Set());
    let finished = false;
    try {
      await apiFetchSse('/packs/generate-draft/stream', {
        token,
        body: {
          prompt,
          outline: outline || undefined,
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
            setGenFailedSections((prev) => {
              const next = new Set(prev);
              next.delete(ev.section);
              return next;
            });
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
            if (ev.section) {
              setGenFailedSections((prev) => new Set(prev).add(ev.section!));
            }
            pushGenToast({
              kind: 'err',
              title: ev.section
                ? `${PACK_GENERATE_SECTION_LABELS[ev.section]}生成失败`
                : '生成警告',
              detail: ev.message,
            });
            return;
          }
          if (ev.type === 'done') {
            finished = true;
            const parsed = storyPackSchema.safeParse(ev.pack);
            if (parsed.success) {
              setPackDraft(parsed.data);
              setClarifySatisfied(false);
            }
            if (ev.profileFields) setProfileFields(ev.profileFields);
            setGenActiveSection(null);
            if (ev.failedSections?.length) {
              setGenFailedSections(
                new Set(ev.failedSections.map((f) => f.section)),
              );
            }
            const summary =
              ev.summary ??
              (ev.source === 'mock'
                ? '流式生成完成（MOCK）。请检查后保存并选用。'
                : '流式生成完成。请检查后保存并选用；个人信息需再点保存。');
            setMessage(summary);
            if (ev.failedSections?.length) {
              setError(
                `仍失败：${ev.failedSections
                  .map((f) => PACK_GENERATE_SECTION_LABELS[f.section])
                  .join('、')}`,
              );
              pushGenToast({
                kind: 'err',
                title: '生成结束（部分失败）',
                detail: summary,
              });
            } else {
              setError(null);
              pushGenToast({
                kind: 'ok',
                title: '生成全部完成',
                detail: summary,
              });
              if (parsed.success) {
                void openClarify(parsed.data, 'review');
              }
            }
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
      setMessage('已恢复默认包');
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

  const tabGroups: Array<Array<{ id: Tab; label: string }>> = [
    [
      { id: 'appearance', label: '外观' },
      { id: 'account', label: '账号' },
    ],
    [
      { id: 'packs', label: '剧情包' },
      { id: 'editor', label: '编辑 Pack' },
      { id: 'traces', label: 'Agent Trace' },
    ],
    [{ id: 'lab', label: '实验室' }],
  ];

  const panelStyle: CSSProperties = {
    background: 'var(--ui-panel-solid)',
    borderColor: 'var(--ui-border)',
    color: 'var(--ui-fg)',
  };

  const cuePath = selection
    ? `${selection.world_id} / ${selection.pack_version_id}${
        selection.is_explicit ? '' : ' · 默认'
      }`
    : '尚未选用剧情包';

  return (
    <main
      className={`settings-shell ${settingsDisplay.variable}`}
      data-header-collapsed={headerCollapsed ? 'true' : 'false'}
    >
      <div className="settings-shell__grain" aria-hidden />
      <div className="settings-shell__inner">
        <header
          className="settings-top"
          data-collapsed={headerCollapsed ? 'true' : 'false'}
        >
          <div className="settings-top__compact">
            <div className="settings-top__compact-inner">
              <button
                type="button"
                className="settings-top__chip"
                onClick={expandSettingsHeader}
                aria-expanded={!headerCollapsed}
                title="展开题头"
              >
                <span className="settings-top__chip-title">设置</span>
                <span className="settings-top__chip-meta">
                  {selection?.world_id ?? username}
                </span>
              </button>
              <Link href="/" className="settings-cta settings-cta--slim">
                返回场景
              </Link>
            </div>
          </div>

          <div className="settings-top__full">
            <div className="settings-top__full-inner">
              <div className="settings-top__row">
                <div className="min-w-0">
                  <p className="settings-top__brand">OCraft · Control</p>
                  <h1 className="settings-top__title">设置</h1>
                </div>
                <Link href="/" className="settings-cta">
                  返回场景
                </Link>
              </div>
              <div className="settings-cue" title={`${username} · ${cuePath}`}>
                <span className="settings-cue__tick" aria-hidden />
                <span className="settings-cue__label">Active pack</span>
                <span
                  className="settings-cue__path"
                  data-empty={selection ? 'false' : 'true'}
                >
                  {username} · {cuePath}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="settings-body">
          <aside className="settings-sidebar shrink-0">
            <p className="settings-sidebar-label">Cue sheet</p>
            <nav className="settings-sidebar-nav" aria-label="设置分类">
              {tabGroups.map((group, gi) => (
                <div key={gi} className="contents">
                  {gi > 0 && (
                    <div className="settings-sidebar-divider" aria-hidden />
                  )}
                  {group.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      data-active={tab === t.id ? 'true' : 'false'}
                      className="settings-nav-btn"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              ))}
            </nav>
          </aside>

          <section
            key={tab}
            className="settings-panel-in min-w-0 flex-1 space-y-4"
          >
          {(error || message) && (
            <div
              className="settings-panel text-sm"
              style={{
                ...panelStyle,
                borderColor: error ? 'var(--ui-danger)' : 'var(--ui-border)',
                color: error ? 'var(--ui-danger)' : 'var(--ui-fg)',
                background: error
                  ? 'color-mix(in srgb, var(--ui-danger) 8%, var(--ui-panel-solid))'
                  : 'color-mix(in srgb, var(--set-gel) 10%, var(--ui-panel-solid))',
              }}
            >
              {error ?? message}
            </div>
          )}

          {tab === 'appearance' && (
            <div className="settings-panel" style={panelStyle}>
              <h2 className="settings-panel__title">外观主题</h2>
              <p className="settings-panel__lead">
                浅色偏纸面；深色偏蓝黑控制台。选好后立刻应用到本页与游戏 HUD。
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
            <div className="settings-panel" style={panelStyle}>
              <h2 className="settings-panel__title">账号</h2>
              <p className="settings-panel__lead">
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
              <div className="settings-panel" style={panelStyle}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="settings-panel__title">世界与版本</h2>
                  <button
                    type="button"
                    className="text-sm"
                    style={{ color: 'var(--ui-accent)' }}
                    onClick={() => void clearSelection()}
                  >
                    恢复默认
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

              <div className="settings-panel" style={panelStyle}>
                <h2 className="settings-panel__title">另存为新版本</h2>
                <p className="settings-panel__lead">
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

              <div className="settings-panel" style={panelStyle}>
                <h2 className="settings-panel__title">新建世界</h2>
                <p className="settings-panel__lead">
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
              <div className="settings-panel" style={panelStyle}>
                <h2 className="settings-panel__title">编辑 Pack</h2>
                <p className="settings-panel__lead">
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
                <div className="settings-panel" style={panelStyle}>
                  <h2 className="settings-panel__title">生成 Pack 草稿</h2>
                  <p
                    className="mt-1 text-sm"
                    style={{ color: 'var(--ui-fg-muted)' }}
                  >
                    先写「梗概或大纲摘要」；完整设定请用「导入大纲」。勾选生成项；未勾选保留当前内容。按依赖顺序串行生成（黄=进行中，绿=完成，红=失败）；单项失败会继续并在末尾重试一次。本世界个人信息只填表单，需再保存。
                  </p>
                  <label className="mt-3 block text-sm font-medium">
                    梗概或大纲摘要
                    <span
                      className="ml-2 font-normal"
                      style={{ color: 'var(--ui-fg-muted)' }}
                    >
                      {genPrompt.length}/{PACK_GENERATE_PROMPT_MAX}
                    </span>
                  </label>
                  <textarea
                    className="mt-1 min-h-[4.5rem] w-full rounded-lg border px-3 py-2 text-sm outline-none placeholder:text-[color:var(--ui-fg-muted)]"
                    style={{
                      background: 'var(--ui-input)',
                      borderColor: 'var(--ui-border)',
                      color: 'var(--ui-fg)',
                    }}
                    value={genPrompt}
                    maxLength={PACK_GENERATE_PROMPT_MAX}
                    onChange={(e) => setGenPrompt(e.target.value)}
                    placeholder="例：校园双 NPC 索伦森与希尔薇；四章无好感门槛；信/不信分叉；地震后三结局"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="rounded-lg border px-3 py-1.5 text-xs"
                      style={{
                        borderColor: 'var(--ui-border)',
                        color: 'var(--ui-accent)',
                      }}
                      onClick={() => setShowOutlineImport((v) => !v)}
                    >
                      {showOutlineImport ? '收起导入大纲' : '导入大纲'}
                    </button>
                    <span
                      className="text-xs"
                      style={{ color: 'var(--ui-fg-muted)' }}
                    >
                      粘贴 Docs/Story 全文等，上限 {PACK_GENERATE_OUTLINE_MAX}{' '}
                      字
                    </span>
                  </div>
                  {showOutlineImport && (
                    <div className="mt-2">
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <label className="text-sm font-medium">
                          大纲全文
                          <span
                            className="ml-2 font-normal"
                            style={{ color: 'var(--ui-fg-muted)' }}
                          >
                            {genOutline.length}/{PACK_GENERATE_OUTLINE_MAX}
                          </span>
                        </label>
                        <label
                          className="cursor-pointer text-xs underline"
                          style={{ color: 'var(--ui-accent)' }}
                        >
                          从文件读入
                          <input
                            type="file"
                            accept=".md,.txt,text/plain,text/markdown"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.target.value = '';
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = () => {
                                const text = String(reader.result ?? '');
                                if (text.length > PACK_GENERATE_OUTLINE_MAX) {
                                  pushGenToast({
                                    kind: 'err',
                                    title: '文件过长',
                                    detail: `超过 ${PACK_GENERATE_OUTLINE_MAX} 字，请截断后再导入`,
                                  });
                                  return;
                                }
                                setGenOutline(text);
                                setShowOutlineImport(true);
                              };
                              reader.readAsText(file, 'utf-8');
                            }}
                          />
                        </label>
                      </div>
                      <textarea
                        className="min-h-[12rem] w-full rounded-lg border px-3 py-2 font-mono text-xs outline-none placeholder:text-[color:var(--ui-fg-muted)]"
                        style={{
                          background: 'var(--ui-input)',
                          borderColor: 'var(--ui-border)',
                          color: 'var(--ui-fg)',
                        }}
                        value={genOutline}
                        maxLength={PACK_GENERATE_OUTLINE_MAX}
                        onChange={(e) => setGenOutline(e.target.value)}
                        placeholder="粘贴完整大纲 Markdown / 纯文本…"
                      />
                    </div>
                  )}
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
                        const failed = genFailedSections.has(key) && !done;
                        return (
                          <label
                            key={key}
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors"
                            style={{
                              background: active
                                ? 'rgba(250, 204, 21, 0.55)'
                                : failed
                                  ? 'rgba(239, 68, 68, 0.18)'
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
                              {active
                                ? ' · 生成中'
                                : failed
                                  ? ' · 失败'
                                  : done
                                    ? ' · 完成'
                                    : ''}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={
                      busy ||
                      (genPrompt.trim().length < 4 &&
                        genOutline.trim().length < 4)
                    }
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
                <div className="settings-panel" style={panelStyle}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="settings-panel__title">本世界个人信息</h2>
                      
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

          {tab === 'traces' && (
            <div className="space-y-4">
              <div className="settings-panel" style={panelStyle}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="settings-panel__title">Agent Trace</h2>
                    <p className="settings-panel__lead">
                      每轮对话的决策回放（tool / 升章 / RAG）。存在服务端内存，重启清空；仅当前账号可见。
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={tracesBusy}
                      onClick={() => void refreshTraces()}
                      className="rounded-lg border px-3 py-1.5 text-sm"
                      style={{ borderColor: 'var(--ui-border)' }}
                    >
                      刷新
                    </button>
                    <button
                      type="button"
                      disabled={tracesBusy}
                      onClick={() => void clearTraces()}
                      className="rounded-lg border px-3 py-1.5 text-sm"
                      style={{
                        borderColor: 'var(--ui-border)',
                        color: 'var(--ui-danger)',
                      }}
                    >
                      清空
                    </button>
                  </div>
                </div>
              </div>

              {traces.length === 0 && (
                <p className="settings-panel__lead">
                  {tracesBusy
                    ? '加载中…'
                    : '暂无记录。进游戏聊几句后再回来刷新。'}
                </p>
              )}

              {traces.map((t) => (
                <div
                  key={t.id}
                  className="settings-panel settings-trace"
                  style={panelStyle}
                >
                  <div className="settings-trace__meta">
                    <span>
                      {new Date(t.at).toLocaleString()} · {t.npc_id}
                      {t.mock ? ' · MOCK' : ''}
                    </span>
                    <span className="settings-trace__path">
                      {t.world_id}/{t.pack_version_id}
                    </span>
                  </div>
                  <p className="mt-2">
                    玩家：「{t.player_message}」
                  </p>
                  {t.director && (
                    <p
                      className="settings-trace__tech mt-2"
                      style={
                        t.director.fallback !== false
                          ? { color: 'var(--ui-danger, #dc2626)' }
                          : undefined
                      }
                    >
                      director:{' '}
                      {t.director.mode ?? '—'}
                      {t.director.speakers && t.director.speakers.length > 0
                        ? ` · speakers [${t.director.speakers.join(', ')}]`
                        : ''}
                      {t.director.reason
                        ? ` · ${t.director.reason}`
                        : ''}
                      {t.director.available_events &&
                      t.director.available_events.length > 0
                        ? ` · events [${t.director.available_events.join(', ')}]`
                        : ''}
                      {' · '}
                      fallback=
                      {t.director.fallback === false
                        ? 'false'
                        : String(t.director.fallback)}
                    </p>
                  )}
                  {t.whisper_source && (
                    <p className="settings-trace__tech">
                      whisper: {t.whisper_source}
                    </p>
                  )}
                  {t.safety && (
                    <p
                      className="settings-trace__tech"
                      style={
                        t.safety.ok
                          ? undefined
                          : { color: 'var(--ui-danger, #dc2626)' }
                      }
                    >
                      safety:{' '}
                      {t.safety.ok
                        ? 'ok'
                        : `block${t.safety.rewritten ? '+rewrite' : ''}`}
                      {t.safety.reasons.length > 0
                        ? ` [${t.safety.reasons.map((r) => r.code).join(', ')}]`
                        : ''}
                    </p>
                  )}
                  <p className="mt-2" style={{ color: 'var(--ui-fg-muted)' }}>
                    数值 {t.runtime_before.affinity}/{t.runtime_before.fatigue} →{' '}
                    {t.runtime_after.affinity}/{t.runtime_after.fatigue}
                    {t.animation ? ` · 动画 ${t.animation}` : ''}
                  </p>
                  <p className="settings-trace__tech">
                    章节 {t.transition.chapter_before}
                    {t.transition.chapter_before !== t.transition.chapter_after
                      ? ` → ${t.transition.chapter_after}`
                      : '（未升章）'}
                    {t.transition.matched_rule_ids.length > 0
                      ? ` · 规则 [${t.transition.matched_rule_ids.join(', ')}]`
                      : ''}
                  </p>
                  {t.transition.flags_set.length > 0 && (
                    <p className="settings-trace__tech">
                      flags:{' '}
                      {t.transition.flags_set
                        .map((f) => `${f.name}=${f.value}`)
                        .join(', ')}
                    </p>
                  )}
                  {t.reply_flags_set && t.reply_flags_set.length > 0 && (
                    <p className="settings-trace__tech">
                      reply_flags:{' '}
                      {t.reply_flags_set
                        .map((f) => `${f.name}=${f.value}`)
                        .join(', ')}
                    </p>
                  )}
                  <p className="settings-trace__tech">
                    tools:{' '}
                    {t.tools.length === 0
                      ? '（无）'
                      : t.tools
                          .map((x) => `${x.tool}: ${x.observation}`)
                          .join(' | ')}
                  </p>
                  <p className="settings-trace__tech">
                    rag
                    {t.rag_path ? ` [${t.rag_path}` : ''}
                    {t.rag_embed_backend
                      ? `/${t.rag_embed_backend}`
                      : t.rag_path
                        ? ''
                        : ''}
                    {t.rag_path ? ']' : ''}
                    {t.rag_error ? ` !${t.rag_error}` : ''}
                    :{' '}
                    {t.rag_hits.length === 0
                      ? '（无）'
                      : t.rag_hits
                          .map(
                            (h) =>
                              `${h.memory_id}(${h.score.toFixed(2)}${h.source ? `/${h.source}` : ''})`,
                          )
                          .join(', ')}
                  </p>
                  {t.working_memory_lines &&
                    t.working_memory_lines.length > 0 && (
                      <p className="settings-trace__tech">
                        scene:{' '}
                        {t.working_memory_lines
                          .map((line) =>
                            line.length > 48
                              ? `${line.slice(0, 48)}…`
                              : line,
                          )
                          .join(' | ')}
                      </p>
                    )}
                  {t.exchange && (
                    <p className="settings-trace__tech">
                      exchange [{t.exchange.event_id}]:{' '}
                      {t.exchange.lines
                        .map((l) => `${l.name}「${l.text.slice(0, 40)}${l.text.length > 40 ? '…' : ''}」`)
                        .join(' → ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'lab' && (
            <div className="space-y-4">
              <div className="settings-panel" style={panelStyle}>
                <h2 className="settings-panel__title">实验室</h2>
                <p className="settings-panel__lead">
                  实验性能力默认关闭，不进入主演示路径。开启仅写入本机浏览器；
                  <strong>当前尚未接入游戏运行时</strong>
                  （开关先落地 UI，后续再接平级 Agent 调度）。
                </p>
              </div>

              <div className="settings-panel" style={panelStyle}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-medium">平级多 Agent</h3>
                    <p
                      className="mt-1 text-sm"
                      style={{ color: 'var(--ui-fg-muted)' }}
                    >
                      关闭导演统筹，由多名 NPC 在限额内更自主地互聊（对照实验）。

                    </p>
                  </div>
                  <span
                    className="rounded-md border px-2 py-1 text-xs"
                    style={{
                      borderColor: 'var(--ui-border)',
                      color: labPeerAgents
                        ? 'var(--ui-danger, #dc2626)'
                        : 'var(--ui-fg-muted)',
                    }}
                  >
                    {labPeerAgents ? '已开启（实验）' : '已关闭（默认）'}
                  </span>
                </div>

                <div
                  className="mt-4 rounded-lg border p-3 text-sm"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--ui-danger, #dc2626) 35%, var(--ui-border))',
                    background:
                      'color-mix(in srgb, var(--ui-danger, #dc2626) 8%, transparent)',
                  }}
                >
                  <p className="font-medium" style={{ color: 'var(--ui-danger, #dc2626)' }}>
                    开启前请确认风险
                  </p>
                  <ul
                    className="mt-2 list-disc space-y-1 pl-5"
                    style={{ color: 'var(--ui-fg)' }}
                  >
                    <li>对话更不可控，易偏题 / 剧透 / 互相抢话</li>
                    <li>Token 与耗时更高；仍禁止改写章节（接运行时后生效）</li>
                    <li>本开关目前只存本机，刷新页面保留，清站点数据会丢失</li>
                  </ul>
                </div>

                {!labPeerAgents ? (
                  <div className="mt-4 space-y-3">
                    <label className="flex cursor-pointer items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={labRiskAck}
                        onChange={(e) => setLabRiskAck(e.target.checked)}
                      />
                      <span>我已阅读上述风险，仍要开启实验室平级多 Agent。</span>
                    </label>
                    <button
                      type="button"
                      disabled={!labRiskAck}
                      className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40"
                      style={{
                        borderColor: 'var(--ui-danger, #dc2626)',
                        color: 'var(--ui-danger, #dc2626)',
                      }}
                      onClick={() => {
                        if (
                          !window.confirm(
                            '确认开启「平级多 Agent」实验室开关？\n主路径仍建议保持导演制；此开关暂不改变游玩逻辑。',
                          )
                        ) {
                          return;
                        }
                        setLabPeerAgentsEnabled(true);
                        setLabPeerAgents(true);
                        setLabRiskAck(false);
                        setMessage('实验室：平级多 Agent 已开启（仅本机标记）');
                      }}
                    >
                      开启实验开关
                    </button>
                  </div>
                ) : (
                  <div className="mt-4">
                    <button
                      type="button"
                      className="rounded-lg border px-3 py-1.5 text-sm"
                      style={{ borderColor: 'var(--ui-border)' }}
                      onClick={() => {
                        setLabPeerAgentsEnabled(false);
                        setLabPeerAgents(false);
                        setLabRiskAck(false);
                        setMessage('实验室：平级多 Agent 已关闭，回到默认导演制标记');
                      }}
                    >
                      关闭并回到默认
                    </button>
                  </div>
                )}
              </div>
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
                      : 'color-mix(in srgb, var(--set-gel) 55%, transparent)',
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

        <PackClarifyModal
          open={clarifyOpen}
          busy={clarifyBusy || busy}
          session={clarifySession}
          error={clarifyError}
          onClose={() => {
            if (clarifyBusy) return;
            setClarifyOpen(false);
            setClarifyPendingAction(null);
          }}
          onForceSave={() => {
            if (!packDraft) return;
            setClarifySatisfied(true);
            setClarifyOpen(false);
            const pending = clarifyPendingAction;
            setClarifyPendingAction(null);
            if (pending === 'save') {
              void performSavePack(packDraft);
            } else {
              setMessage('已不接受澄清建议，可直接保存到磁盘。');
            }
          }}
          onSubmit={(answers) => {
            void applyClarifyAnswers(answers, true);
          }}
          onPolish={async (opts) => {
            try {
              const res = await apiFetch<{
                polished_text: string;
              }>('/packs/clarify/polish', {
                token,
                method: 'POST',
                body: opts,
              });
              return res.polished_text;
            } catch (err) {
              setClarifyError(
                err instanceof Error ? err.message : '润色失败',
              );
              return null;
            }
          }}
        />
      </div>
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
