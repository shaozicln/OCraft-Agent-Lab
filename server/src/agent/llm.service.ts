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
