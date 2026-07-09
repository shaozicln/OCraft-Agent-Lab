import type { LlmMessage } from './llm.schema';
import type { ToolCallResult } from './ws.schema';
/**
 * Mock 回复唯一入口：基于 Harness 已组装的 messages + 工具执行结果生成回复。
 * 不再维护独立的关键词表。
 */
export declare function buildMockReplyFromContext(messages: LlmMessage[], toolCalls: ToolCallResult[]): string;
