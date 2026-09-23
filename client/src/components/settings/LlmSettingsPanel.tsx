'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { PlayerLlmSettings } from '@ocraft/shared';
import { apiFetch } from '@/lib/api';

const PRESETS: Array<{
  id: string;
  label: string;
  baseUrl: string;
  model: string;
}> = [
  { id: 'custom', label: '自定义', baseUrl: '', model: '' },
  {
    id: 'qwen',
    label: '通义千问（DashScope）',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  {
    id: 'moonshot',
    label: 'Kimi（Moonshot）',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
  },
  {
    id: 'zhipu',
    label: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
  },
  {
    id: 'doubao',
    label: '豆包（火山方舟）',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-pro-32k',
  },
  {
    id: 'baichuan',
    label: '百川智能',
    baseUrl: 'https://api.baichuan-ai.com/v1',
    model: 'Baichuan4',
  },
  {
    id: 'stepfun',
    label: '阶跃星辰 StepFun',
    baseUrl: 'https://api.stepfun.com/v1',
    model: 'step-1-8k',
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    baseUrl: 'https://api.minimax.chat/v1',
    model: 'abab6.5s-chat',
  },
  {
    id: 'siliconflow',
    label: '硅基流动 SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'Qwen/Qwen2.5-7B-Instruct',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
  },
  {
    id: 'ollama',
    label: 'Ollama 本地',
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: 'llama3.1',
  },
  {
    id: 'lmstudio',
    label: 'LM Studio 本地',
    baseUrl: 'http://127.0.0.1:1234/v1',
    model: '',
  },
  {
    id: 'vllm',
    label: 'vLLM / 自建',
    baseUrl: 'http://127.0.0.1:8000/v1',
    model: '',
  },
];

type ThinkingChoice = 'inherit' | 'off' | 'on';

function thinkingFromSaved(v: boolean | null): ThinkingChoice {
  if (v == null) return 'inherit';
  return v ? 'on' : 'off';
}

function thinkingToPatch(v: ThinkingChoice): boolean | null {
  if (v === 'inherit') return null;
  return v === 'on';
}

const inputStyle: CSSProperties = {
  background: 'var(--ui-input)',
  borderColor: 'var(--ui-border)',
  color: 'var(--ui-fg)',
};

export function LlmSettingsPanel({
  token,
  panelStyle,
  onError,
  onMessage,
}: {
  token: string;
  panelStyle: CSSProperties;
  onError: (msg: string | null) => void;
  onMessage: (msg: string | null) => void;
}) {
  const [loaded, setLoaded] = useState<PlayerLlmSettings | null>(null);
  const [presetText, setPresetText] = useState('自定义');
  const [presetOpen, setPresetOpen] = useState(false);
  const presetWrapRef = useRef<HTMLDivElement>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [embedModel, setEmbedModel] = useState('');
  const [directorModel, setDirectorModel] = useState('');
  const [thinking, setThinking] = useState<ThinkingChoice>('inherit');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  const applyLoaded = useCallback((s: PlayerLlmSettings) => {
    setLoaded(s);
    setBaseUrl(s.baseUrl);
    setModel(s.model);
    setEmbedModel(s.embedModel);
    setDirectorModel(s.directorModel);
    setThinking(thinkingFromSaved(s.enableThinking));
    setApiKey('');
    const matched = PRESETS.find(
      (p) => p.id !== 'custom' && p.baseUrl === s.baseUrl,
    );
    setPresetText(matched?.label ?? '自定义');
  }, []);

  const refresh = useCallback(async () => {
    const s = await apiFetch<PlayerLlmSettings>('/players/me/llm', { token });
    applyLoaded(s);
  }, [token, applyLoaded]);

  useEffect(() => {
    void (async () => {
      try {
        await refresh();
      } catch (err) {
        onError(err instanceof Error ? err.message : '加载 AI 接口失败');
      }
    })();
  }, [refresh, onError]);

  useEffect(() => {
    if (!presetOpen) return;
    const onDocDown = (e: MouseEvent) => {
      if (!presetWrapRef.current?.contains(e.target as Node)) {
        setPresetOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [presetOpen]);

  const applyPreset = (raw: string) => {
    setPresetText(raw);
    const p = PRESETS.find((x) => x.label === raw || x.id === raw);
    if (!p || p.id === 'custom') return;
    setBaseUrl(p.baseUrl);
    if (p.model) setModel(p.model);
  };

  const patchBody = () => ({
    baseUrl,
    model,
    embedModel,
    directorModel,
    enableThinking: thinkingToPatch(thinking),
    ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
  });

  const save = async () => {
    setBusy(true);
    onError(null);
    onMessage(null);
    try {
      const s = await apiFetch<PlayerLlmSettings>('/players/me/llm', {
        token,
        method: 'PUT',
        body: patchBody(),
      });
      applyLoaded(s);
      onMessage(
        s.effective.mock
          ? '已保存。尚未凑齐 Key + Base URL，对话仍会走占位回复。'
          : '已保存，对话将使用你填写的接口。',
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setBusy(false);
    }
  };

  const clearKey = async () => {
    if (!loaded?.hasApiKey) {
      setApiKey('');
      return;
    }
    if (!window.confirm('清除已保存的 API Key？未填新 Key 时将回退服务器配置。')) {
      return;
    }
    setBusy(true);
    onError(null);
    onMessage(null);
    try {
      const s = await apiFetch<PlayerLlmSettings>('/players/me/llm', {
        token,
        method: 'PUT',
        body: { clearApiKey: true },
      });
      applyLoaded(s);
      onMessage('已清除账号里的 API Key。');
    } catch (err) {
      onError(err instanceof Error ? err.message : '清除失败');
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setTesting(true);
    onError(null);
    onMessage(null);
    try {
      const res = await apiFetch<{ ok: boolean; model: string; preview?: string }>(
        '/players/me/llm/test',
        { token, method: 'POST', body: patchBody() },
      );
      onMessage(
        `连通正常（${res.model}）${res.preview ? `：${res.preview}` : ''}`,
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : '测试失败');
    } finally {
      setTesting(false);
    }
  };

  const sourceLabel =
    loaded?.effective.source === 'player'
      ? '当前账号'
      : loaded?.effective.source === 'env'
        ? '服务器 .env 回退'
        : '未配置（MOCK 占位回复）';

  return (
    <div className="space-y-4">
      <div className="settings-panel" style={panelStyle}>
        <h2 className="settings-panel__title">AI 接口</h2>
        <p className="settings-panel__lead">
          填写自己的 OpenAI 兼容接口即可对话与生成，不必改代码或
          <span className="font-mono"> .env</span>
          。你的 API Key 会先经 AES 加密再存入服务器，不会明文落库、也不会回传明文，其他用户无法读取；你随时可以在下方一键清空它在服务器的存储，或更换为新 Key。留空的项回退服务器配置。
        </p>
        {loaded && (
          <p
            className="mt-3 rounded-lg border px-3 py-2 text-sm"
            style={{
              borderColor: loaded.effective.mock
                ? 'var(--ui-danger)'
                : 'var(--ui-border)',
              color: loaded.effective.mock
                ? 'var(--ui-danger)'
                : 'var(--ui-fg)',
            }}
          >
            当前生效：{sourceLabel}
            {loaded.effective.model ? ` · ${loaded.effective.model}` : ''}
            {loaded.effective.baseUrl
              ? ` · ${loaded.effective.baseUrl}`
              : ''}
          </p>
        )}
      </div>

      <div className="settings-panel" style={panelStyle}>
        <div className="block text-sm">
          <span style={{ color: 'var(--ui-fg-muted)' }}>服务商预设</span>
          <div className="relative mt-1" ref={presetWrapRef}>
            <input
              className="w-full rounded-lg border px-3 py-2 pr-9 text-sm outline-none"
              style={inputStyle}
              value={presetText}
              onChange={(e) => applyPreset(e.target.value)}
              onFocus={() => setPresetOpen(true)}
              placeholder="点箭头选预设，或直接输入"
              autoComplete="off"
              role="combobox"
              aria-expanded={presetOpen}
              aria-controls="llm-preset-listbox"
            />
            <button
              type="button"
              aria-label={presetOpen ? '收起预设' : '展开预设'}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs"
              style={{ color: 'var(--ui-fg-muted)' }}
              onClick={() => setPresetOpen((v) => !v)}
            >
              {presetOpen ? '▲' : '▼'}
            </button>
            {presetOpen && (
              <ul
                id="llm-preset-listbox"
                role="listbox"
                className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border shadow-lg"
                style={{
                  background: 'var(--ui-panel-solid)',
                  borderColor: 'var(--ui-border)',
                }}
              >
                {PRESETS.map((p) => (
                  <li key={p.id} role="option" aria-selected={p.label === presetText}>
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm"
                      style={{
                        color:
                          p.label === presetText
                            ? 'var(--ui-accent)'
                            : 'var(--ui-fg)',
                      }}
                      onClick={() => {
                        applyPreset(p.label);
                        setPresetOpen(false);
                      }}
                    >
                      {p.label}
                      {p.baseUrl && (
                        <span
                          className="ml-2 font-mono text-xs"
                          style={{ color: 'var(--ui-fg-muted)' }}
                        >
                          {p.baseUrl}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <label className="mt-3 block text-sm">
          <span style={{ color: 'var(--ui-fg-muted)' }}>Base URL</span>
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm outline-none"
            style={inputStyle}
            value={baseUrl}
            list="llm-baseurl-list"
            onChange={(e) => {
              setBaseUrl(e.target.value);
              setPresetText('自定义');
            }}
            placeholder="https://api.example.com/v1"
            autoComplete="off"
          />
          <datalist id="llm-baseurl-list">
            {PRESETS.filter((p) => p.baseUrl).map((p) => (
              <option key={p.id} value={p.baseUrl} />
            ))}
          </datalist>
        </label>

        <label className="mt-3 block text-sm">
          <span style={{ color: 'var(--ui-fg-muted)' }}>API Key</span>
          <input
            type="password"
            className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm outline-none"
            style={inputStyle}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              loaded?.hasApiKey
                ? `已保存 ${loaded.apiKeyMasked}，留空则不改`
                : 'sk-… 或本地占位如 lmstudio'
            }
            autoComplete="off"
          />
        </label>

        <label className="mt-3 block text-sm">
          <span style={{ color: 'var(--ui-fg-muted)' }}>模型名</span>
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm outline-none"
            style={inputStyle}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="如 qwen-plus、deepseek-chat"
            autoComplete="off"
          />
        </label>

        <div className="mt-3">
          <button
            type="button"
            className="text-xs underline"
            style={{ color: 'var(--ui-accent)' }}
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? '收起高级选项' : '高级选项'}
          </button>
        </div>

        {showAdvanced && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span style={{ color: 'var(--ui-fg-muted)' }}>嵌入模型</span>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm outline-none"
                style={inputStyle}
                value={embedModel}
                onChange={(e) => setEmbedModel(e.target.value)}
                placeholder="可选，如 text-embedding-v3"
              />
            </label>
            <label className="block text-sm">
              <span style={{ color: 'var(--ui-fg-muted)' }}>导演模型</span>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm outline-none"
                style={inputStyle}
                value={directorModel}
                onChange={(e) => setDirectorModel(e.target.value)}
                placeholder="可选，默认与对话模型相同"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span style={{ color: 'var(--ui-fg-muted)' }}>深度思考</span>
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2"
                style={inputStyle}
                value={thinking}
                onChange={(e) =>
                  setThinking(e.target.value as ThinkingChoice)
                }
              >
                <option value="inherit">跟随服务器（默认关）</option>
                <option value="off">关闭（推荐，对话更快）</option>
                <option value="on">开启</option>
              </select>
            </label>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{
              background: 'var(--ui-accent)',
              color: 'var(--ui-accent-fg)',
            }}
          >
            {busy ? '保存中…' : '保存'}
          </button>
          <button
            type="button"
            disabled={testing || busy}
            onClick={() => void test()}
            className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
            style={{ borderColor: 'var(--ui-border)' }}
          >
            {testing ? '测试中…' : '测试连通'}
          </button>
          <button
            type="button"
            disabled={busy || (!loaded?.hasApiKey && !apiKey)}
            onClick={() => void clearKey()}
            className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
            style={{
              borderColor: 'var(--ui-border)',
              color: 'var(--ui-danger)',
            }}
          >
            清除 Key
          </button>
        </div>
      </div>
    </div>
  );
}
