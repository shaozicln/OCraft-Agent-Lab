"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAutoPlayGoalReached = isAutoPlayGoalReached;
exports.parseAutoPlayNextJson = parseAutoPlayNextJson;
exports.mockProposeAutoPlayNext = mockProposeAutoPlayNext;
const autoplay_schema_1 = require("./autoplay.schema");
function isAutoPlayGoalReached(goal, actual) {
    return (0, autoplay_schema_1.resolveAutoPlayStopKind)(goal, actual) != null;
}
function parseAutoPlayNextJson(raw) {
    try {
        const parsed = JSON.parse(raw);
        const r = autoplay_schema_1.autoPlayNextProposalSchema.safeParse({
            ...(typeof parsed === 'object' && parsed ? parsed : {}),
            source: 'agent',
        });
        if (!r.success)
            return null;
        const lines = (0, autoplay_schema_1.normalizeAutoPlayBeatLines)(r.data);
        if (!r.data.done && lines.length === 0)
            return null;
        const playerSay = lines.find((l) => l.speaker_kind === 'player')?.text ?? r.data.say;
        return {
            ...r.data,
            lines,
            say: playerSay,
        };
    }
    catch {
        return null;
    }
}
/**
 * MOCK / 无 key：按章与目标启发式生成下一拍（eval 夹具；运行时自动演禁 MOCK）
 */
function mockProposeAutoPlayNext(input) {
    const { goal, turnIndex, chapterId, flagNames, availableEvents, priorSays, focusNpcName, sawTargetExchange, requirePlayerLine, } = input;
    if (isAutoPlayGoalReached(goal, {
        chapter: chapterId,
        sawTargetExchange,
    })) {
        return {
            done: true,
            reason: '目标已达成',
            source: 'mock',
            lines: [],
        };
    }
    // eval 夹具仍可用 max_turns 软结束；产品路径不应走到 MOCK
    if (turnIndex >= goal.max_turns) {
        return {
            done: true,
            reason: '达到拍数软顶（MOCK）',
            source: 'mock',
            lines: [],
        };
    }
    const hasMetHook = flagNames.includes('met_hook');
    const exchangeReady = goal.target_exchange != null &&
        availableEvents.includes(goal.target_exchange);
    const playerLine = (text, reason) => ({
        say: text,
        lines: [{ speaker_kind: 'player', speaker_id: 'player', text }],
        done: false,
        reason,
        source: 'mock',
    });
    const npcLine = (text, reason) => ({
        lines: [
            {
                speaker_kind: 'npc',
                speaker_id: goal.npc_id,
                text,
            },
        ],
        done: false,
        reason,
        source: 'mock',
    });
    if (goal.target_chapter &&
        chapterId === goal.target_chapter &&
        (exchangeReady || hasMetHook) &&
        !sawTargetExchange) {
        const say = priorSays.length === 0
            ? `对了，${focusNpcName}，走廊钟声是不是有点怪？`
            : '你刚才说的转校生……她现在在附近吗？';
        return playerLine(say, '目标章已到，推进互聊窗口');
    }
    if (requirePlayerLine || input.accelerate) {
        if (chapterId === 'ch1_daily' || chapterId.startsWith('ch1_')) {
            if (turnIndex === 0 && priorSays.length === 0) {
                return playerLine('放学一起去球场吗', '开场闲聊');
            }
            return playerLine('听说有转校生要来，叫希尔薇？', '点名钩子推进升章');
        }
        if (goal.target_chapter && chapterId !== goal.target_chapter) {
            return playerLine('最近班上有什么新消息吗？听说要来转校生……', '未达目标章，试探推进');
        }
        return playerLine(`${focusNpcName}，我们继续刚才的话题吧。`, '保底续聊');
    }
    // AP-1：无玩家门槛时允许纯 NPC 拍
    return npcLine('刚才那事……你们怎么看？', 'NPC 排场拍');
}
