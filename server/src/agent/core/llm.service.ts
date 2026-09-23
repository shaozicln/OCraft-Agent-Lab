import { AsyncLocalStorage } from 'async_hooks';
import { Injectable, Logger, Optional } from '@nestjs/common';
import OpenAI from 'openai';
import {
  buildMockReplyFromContext,
  LlmMessage,
  ToolCallResult,
} from '@ocraft/shared';
import { LlmSettingsService, envLlmConfig } from './llm-settings.service';
import type { ResolvedLlmConfig } from './llm.types';

export interface StreamChunk {
  text: string;
  done?: boolean;
}

export interface StreamChatOptions {
  toolCalls?: ToolCallResult[];
}

export interface LlmToolCallRequest {
  id: string;
  name: string;
  arguments: string;
}

export interface ChatWithToolsResult {
  content: string | null;
  toolCalls: LlmToolCallRequest[];
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly als = new AsyncLocalStorage<ResolvedLlmConfig>();
  private readonly clients = new Map<string, OpenAI>();
  /** 无玩家上下文时（eval 脚本）使用的进程级配置 */
  private readonly envConfig: ResolvedLlmConfig;

  constructor(@Optional() private readonly settings?: LlmSettingsService) {
    this.envConfig = envLlmConfig();
    if (this.envConfig.source === 'none') {
      this.logger.warn(
        'no LLM credentials in .env — fill AI API in Settings, or set LLM_API_KEY / LLM_BASE_URL',
      );
    }
  }

  async runForPlayer<T>(
    playerId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const config = this.settings
      ? await this.settings.resolve(playerId)
      : this.envConfig;
    return this.als.run(config, fn);
  }

  async runWithConfig<T>(
    config: ResolvedLlmConfig,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.als.run(config, fn);
  }

  private resolved(): ResolvedLlmConfig {
    return this.als.getStore() ?? this.envConfig;
  }

  private client(): OpenAI | null {
    const cfg = this.resolved();
    if (!cfg.apiKey || !cfg.baseURL) return null;
    const cacheKey = `${cfg.baseURL}\0${cfg.apiKey}`;
    const cached = this.clients.get(cacheKey);
    if (cached) return cached;
    const created = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });
    this.clients.set(cacheKey, created);
    return created;
  }

  /** 配置（尤其 Key）变更/清空后，丢弃缓存的 client，避免旧 Key 常驻内存 */
  dropClientFor(config: ResolvedLlmConfig): void {
    if (!config.apiKey || !config.baseURL) return;
    this.clients.delete(`${config.baseURL}\0${config.apiKey}`);
  }

  isMockMode(): boolean {
    return this.resolved().source === 'none';
  }

  chatModel(): string {
    return this.resolved().model || 'qwen-plus';
  }

  directorModel(): string {
    const cfg = this.resolved();
    return cfg.directorModel || cfg.model || 'qwen-plus';
  }

  /**
   * DashScope 用 enable_thinking；LM Studio / llama.cpp 认 chat_template_kwargs。
   * hybrid 默认会先写 reasoning_content，前端像卡住。游戏默认关思考。
   */
  private vendorBodyExtras(): Record<string, unknown> {
    const thinking = this.resolved().enableThinking;
    return {
      enable_thinking: thinking,
      chat_template_kwargs: { enable_thinking: thinking },
    };
  }

  /**
   * 非流式补全。JSON 模式时尽量解析为对象；失败返回原文。
   */
  async complete(
    messages: LlmMessage[],
    opts: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      json?: boolean;
    } = {},
  ): Promise<string> {
    const client = this.client();
    if (!client) {
      return this.mockComplete(messages);
    }
    const model = opts.model || this.chatModel();
    const res = await client.chat.completions.create({
      model,
      messages,
      temperature: opts.temperature ?? 0.4,
      ...(opts.maxTokens != null ? { max_tokens: opts.maxTokens } : {}),
      ...(opts.json
        ? { response_format: { type: 'json_object' as const } }
        : {}),
      ...this.vendorBodyExtras(),
    });
    return res.choices[0]?.message?.content?.trim() ?? '';
  }

  /**
   * 带 Function Calling 的一轮非流式补全（模型可返回 tool_calls）。
   */
  async chatWithTools(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    tools: OpenAI.Chat.ChatCompletionTool[],
    opts: { model?: string; temperature?: number } = {},
  ): Promise<ChatWithToolsResult> {
    const client = this.client();
    if (!client) {
      return this.mockChatWithTools(messages);
    }

    const model = opts.model || this.chatModel();
    const res = await client.chat.completions.create({
      model,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: opts.temperature ?? 0.4,
      ...this.vendorBodyExtras(),
    });

    const msg = res.choices[0]?.message;
    const toolCalls: LlmToolCallRequest[] = (msg?.tool_calls ?? [])
      .filter((t) => t.type === 'function')
      .map((t) => ({
        id: t.id,
        name: t.function.name,
        arguments: t.function.arguments ?? '{}',
      }));

    return {
      content: msg?.content?.trim() || null,
      toolCalls,
    };
  }

  /**
   * Mem-V：批量 embedding。无 client / 失败时返回 null（调用方回退本地或关键词）。
   */
  async embed(texts: string[]): Promise<number[][] | null> {
    const client = this.client();
    if (!client || texts.length === 0) return null;
    try {
      const model = this.resolved().embedModel || 'text-embedding-v3';
      const res = await client.embeddings.create({
        model,
        input: texts,
      });
      const sorted = [...res.data].sort((a, b) => a.index - b.index);
      return sorted.map((d) => d.embedding as number[]);
    } catch (err) {
      this.logger.warn(
        `embed failed: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  async *streamChat(
    messages: LlmMessage[],
    options: StreamChatOptions = {},
    model?: string,
  ): AsyncGenerator<StreamChunk> {
    const client = this.client();
    if (!client) {
      yield* this.mockStream(messages, options.toolCalls ?? []);
      return;
    }

    const stream = await client.chat.completions.create({
      model: model || this.chatModel(),
      messages,
      stream: true,
      temperature: 0.8,
      ...this.vendorBodyExtras(),
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? '';
      if (text) {
        yield { text };
      }
    }
    yield { text: '', done: true };
  }

  /** 工具轮已有正文且无 tool_calls 时，跳过第二次 LLM，直接当流式吐出。 */
  async *streamFromText(text: string): AsyncGenerator<StreamChunk> {
    const trimmed = text.trim();
    if (trimmed) {
      yield { text: trimmed };
    }
    yield { text: '', done: true };
  }

  private mockComplete(messages: LlmMessage[]): string {
    const system = messages.find((m) => m.role === 'system')?.content ?? '';
    if (/对「希尔薇」/.test(system)) {
      return '希尔薇？嗯……转校这事，我总觉得哪里不对劲。';
    }
    if (/对「索伦森」/.test(system)) {
      return '……你好。听说你们班最近有点吵？';
    }
    return '（MOCK 互聊）嗯……你也感觉到了吗？';
  }

  /** MOCK：模拟一次「模型决定」的 tool_calls（非 Pack 关键词规则引擎） */
  private mockChatWithTools(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
  ): ChatWithToolsResult {
    const lastUser = [...messages]
      .reverse()
      .find((m) => m.role === 'user');
    const text =
      typeof lastUser?.content === 'string'
        ? lastUser.content
        : Array.isArray(lastUser?.content)
          ? lastUser.content
              .map((p) => ('text' in p ? p.text : ''))
              .join('')
          : '';

    const toolCalls: LlmToolCallRequest[] = [];
    // 仅 MOCK 演示用的轻量启发式，正式路径走真实 FC
    if (/记得|回忆|想起|那件事|球场|转校生|希尔薇来/.test(text)) {
      toolCalls.push({
        id: 'mock_recall_memory',
        name: 'recall_memory',
        arguments: JSON.stringify({
          query: text.slice(0, 40),
          reason: 'MOCK：追问往事',
        }),
      });
    } else if (/好感|累不累|疲[惫劳]|现在什么章|当前状态|查(一下|下)进度/.test(text)) {
      toolCalls.push({
        id: 'mock_query_runtime',
        name: 'query_runtime',
        arguments: JSON.stringify({ reason: 'MOCK：核对运行时' }),
      });
    } else if (/给(我|点)?提示|我该怎么办|下一步怎么|卡关/.test(text)) {
      toolCalls.push({
        id: 'mock_request_hint',
        name: 'request_hint',
        arguments: JSON.stringify({
          topic: '推进',
          reason: 'MOCK：需要本章提示',
        }),
      });
    } else if (/累|疲|加班|压力|焦虑|困/.test(text)) {
      toolCalls.push({
        id: 'mock_fatigue',
        name: 'updateFatigue',
        arguments: JSON.stringify({
          delta: 12,
          reason: 'MOCK：话题偏累',
        }),
      });
    } else if (/喜欢|谢谢|有意思|有趣|开心/.test(text)) {
      toolCalls.push({
        id: 'mock_affinity',
        name: 'updateAffinity',
        arguments: JSON.stringify({
          delta: 8,
          reason: 'MOCK：关系升温',
        }),
      });
      toolCalls.push({
        id: 'mock_fatigue_down',
        name: 'updateFatigue',
        arguments: JSON.stringify({
          delta: -10,
          reason: 'MOCK：聊得放松',
        }),
      });
    }

    return { content: null, toolCalls };
  }

  private async *mockStream(
    messages: LlmMessage[],
    toolCalls: ToolCallResult[],
  ): AsyncGenerator<StreamChunk> {
    const reply = buildMockReplyFromContext(messages, toolCalls);
    for (const char of reply.split('')) {
      yield { text: char };
      await this.delay(20 + Math.random() * 30);
    }
    yield { text: '', done: true };
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
