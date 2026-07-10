"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMockReplyFromContext = buildMockReplyFromContext;
/**
 * Mock 回复：无 LLM Key 时的通用占位（不含具体剧情文案）。
 */
function buildMockReplyFromContext(messages, toolCalls) {
    const fatigueDelta = sumToolDelta(toolCalls, 'updateFatigue');
    const affinityDelta = sumToolDelta(toolCalls, 'updateAffinity');
    if (fatigueDelta > 0) {
        return '……（打了个哈欠，把脸埋回胳膊里）';
    }
    if (affinityDelta > 0) {
        return '嗯……听你这么说，我倒是有点精神了。';
    }
    const userMsg = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    if (userMsg) {
        return '嗯……你刚才说什么？再说一遍？';
    }
    return '……';
}
function sumToolDelta(toolCalls, tool) {
    return toolCalls
        .filter((t) => t.tool === tool)
        .reduce((sum, t) => sum + Number(t.args.delta ?? 0), 0);
}
