import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import {
  buildMockReplyFromContext,
  LlmMessage,
  ToolCallResult,
} from '@ocraft/shared';

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
  private readonly client: OpenAI | null;

  constructor() {
    const apiKey = process.env.LLM_API_KEY;
    const baseURL = process.env.LLM_BASE_URL;
    this.client =
      apiKey && baseURL
        ? new OpenAI({ apiKey, baseURL })
        : null;

    if (!this.client) {
      this.logger.warn(
        'LLM_API_KEY / LLM_BASE_URL not set — running in MOCK mode',
      );
    }
  }

  isMockMode(): boolean {
    return !this.client;
  }

  /**
   * 非流式补全。JSON 模式时尽量解析为对象；失败返回原文。
   */
  async complete(
    messages: LlmMessage[],
    opts: {
      model?: string;
      temperature?: number;
      json?: boolean;
    } = {},
  ): Promise<string> {
    if (!this.client) {
      throw new Error('LLM 未配置（MOCK 模式无 complete）');
    }
    const model = opts.model ?? process.env.LLM_MODEL ?? 'qwen-plus';
    const res = await this.client.chat.completions.create({
      model,
      messages,
      temperature: opts.temperature ?? 0.4,
      ...(opts.json
        ? { response_format: { type: 'json_object' as const } }
        : {}),
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
    if (!this.client) {
      return this.mockChatWithTools(messages);
    }

    const model = opts.model ?? process.env.LLM_MODEL ?? 'qwen-plus';
    const res = await this.client.chat.completions.create({
      model,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: opts.temperature ?? 0.4,
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

  async *streamChat(
    messages: LlmMessage[],
    options: StreamChatOptions = {},
    model = process.env.LLM_MODEL ?? 'qwen-plus',
  ): AsyncGenerator<StreamChunk> {
    if (!this.client) {
      yield* this.mockStream(messages, options.toolCalls ?? []);
      return;
    }

    const stream = await this.client.chat.completions.create({
      model,
      messages,
      stream: true,
      temperature: 0.8,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? '';
      if (text) {
        yield { text };
      }
    }
    yield { text: '', done: true };
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
    if (/累|疲|加班|压力|焦虑|困/.test(text)) {
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
