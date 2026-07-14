import type OpenAI from 'openai';
import type { StoryPack } from '@ocraft/shared';

/** OpenAI 兼容的受控工具定义（好感 / 疲惫） */
export function buildNpcToolDefinitions(
  pack: StoryPack,
): OpenAI.Chat.ChatCompletionTool[] {
  const num = pack.world.numeric_tools;
  return [
    {
      type: 'function',
      function: {
        name: 'updateFatigue',
        description: [
          '调整当前 NPC 的疲惫值（fatigue）。正数更累，负数更放松。',
          `本 Pack 参考：话题压力类常用 delta≈${num.fatigue_increase.delta}（${num.fatigue_increase.reason}）；`,
          `兴趣放松类常用 fatigue delta≈${num.interest_hit.fatigue_delta}（${num.interest_hit.fatigue_reason}）。`,
          '仅在玩家话语确实影响精力/压力时调用；闲聊不必每次都调。',
        ].join(''),
        parameters: {
          type: 'object',
          properties: {
            delta: {
              type: 'integer',
              description: '疲惫变化量，范围 -100～100',
            },
            reason: {
              type: 'string',
              description: '简短中文原因，供日志与旁白',
            },
          },
          required: ['delta'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'updateAffinity',
        description: [
          '调整当前 NPC 对玩家的好感度（affinity）。正数更亲近，负数更疏远。',
          `本 Pack 参考：兴趣命中常用 affinity delta≈${num.interest_hit.affinity_delta}（${num.interest_hit.affinity_reason}）。`,
          '仅在关系确实发生变化时调用；不要无故刷好感。',
        ].join(''),
        parameters: {
          type: 'object',
          properties: {
            delta: {
              type: 'integer',
              description: '好感变化量，范围 -100～100',
            },
            reason: {
              type: 'string',
              description: '简短中文原因',
            },
          },
          required: ['delta'],
        },
      },
    },
  ];
}
