import type { LlmMessage } from './llm.schema';
import type { ToolCallResult } from './ws.schema';
import type { UpdateFatigueArgs } from './tools.schema';

/**
 * Mock 回复：无 LLM Key 时的通用占位（不含具体剧情文案）。
 */
export function buildMockReplyFromContext(
  messages: LlmMessage[],
  toolCalls: ToolCallResult[],
): string {
  const fatigueDelta = sumToolDelta(toolCalls, 'updateFatigue');
  const affinityDelta = sumToolDelta(toolCalls, 'updateAffinity');

  if (fatigueDelta > 0) {
    return '……（打了个哈欠，把脸埋回胳膊里）';
  }

  if (affinityDelta > 0) {
    return '嗯……听你这么说，我倒是有点精神了。';
  }

  const userMsg =
    [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  if (userMsg) {
    return '嗯……你刚才说什么？再说一遍？';
  }

  return '……';
}

function sumToolDelta(toolCalls: ToolCallResult[], tool: string): number {
  return toolCalls
    .filter((t) => t.tool === tool)
    .reduce((sum, t) => sum + Number((t.args as UpdateFatigueArgs).delta ?? 0), 0);
}
