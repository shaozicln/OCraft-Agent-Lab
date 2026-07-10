import type { LlmMessage } from './llm.schema';
import type { ToolCallResult } from './ws.schema';
/**
 * Mock 回复：无 LLM Key 时的通用占位（不含具体剧情文案）。
 */
export declare function buildMockReplyFromContext(messages: LlmMessage[], toolCalls: ToolCallResult[]): string;
