import type { LlmMessage } from './llm.schema';
import type { ToolCallResult } from './ws.schema';
import type { UpdateFatigueArgs } from './tools.schema';

/**
 * Mock 回复唯一入口：基于 Harness 已组装的 messages + 工具执行结果生成回复。
 * 不再维护独立的关键词表。
 */
export function buildMockReplyFromContext(
  messages: LlmMessage[],
  toolCalls: ToolCallResult[],
): string {
  const userMsg =
    [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';

  const fatigueDelta = sumToolDelta(toolCalls, 'updateFatigue');
  const affinityDelta = sumToolDelta(toolCalls, 'updateAffinity');

  if (fatigueDelta > 0) {
    return '别……别跟我提这些……（把头埋回胳膊里）我已经连续熬了三天了，让我再趴五分钟……';
  }

  if (affinityDelta > 0 && fatigueDelta < 0) {
    if (/玩游戏|游戏|端游/.test(userMsg)) {
      return '真的吗？！刚上一款冷门新游戏，正愁没人组队……你一提到玩游戏我困意全无！今晚十点准时走，谁鸽谁请客！';
    }
    if (/吃饭|吃饭|外卖/.test(userMsg)) {
      return '吃饭？这个点我本该趴桌睡觉的……但拼单的话我可以勉强睁眼。老规矩，你选店我付钱（下次）。';
    }
    if (/假期|放假|摸鱼/.test(userMsg)) {
      return '别提假期……我脑子里已经开始规划躺平日程了。你说咱们离下次长假还有几天来着？';
    }
    return '行吧……你这话我听着还挺顺耳的，我勉强从桌上抬个头。';
  }

  if (/下班/.test(userMsg)) {
    return '下班……这两个字是我今天唯一的动力。再撑一会儿，打卡机见。';
  }

  return '嗯……（打哈欠）你说啥？我刚梦到在工位上玩游戏……要不你再说一遍？';
}

function sumToolDelta(toolCalls: ToolCallResult[], tool: string): number {
  return toolCalls
    .filter((t) => t.tool === tool)
    .reduce((sum, t) => sum + Number((t.args as UpdateFatigueArgs).delta ?? 0), 0);
}
