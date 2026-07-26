import type OpenAI from 'openai';
import type { StoryPack } from '@ocraft/shared';

/** OpenAI 兼容的受控工具定义：软数值 + 强只读指令 */
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
    {
      type: 'function',
      function: {
        name: 'query_runtime',
        description: [
          '【强指令·只读】查询当前章节、好感、疲惫、状态与已置故事旗标摘要。',
          '在需要核对数值/进度、或玩家追问「你现在累不累/好感怎样」时调用。',
          '不能改章节、不能发明事件；闲聊不必调用。',
        ].join(''),
        parameters: {
          type: 'object',
          properties: {
            reason: {
              type: 'string',
              description: '为何查询（短）',
            },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'request_hint',
        description: [
          '【强指令·只读】获取一条受当前章节约束的扮演提示（不含未解锁章剧透）。',
          '仅当推进卡住、需要把握分寸时调用；不要用来改数值或升章。',
          '可选 topic 收窄主题。',
        ].join(''),
        parameters: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              description: '可选：提示主题关键词',
            },
            reason: {
              type: 'string',
              description: '为何需要提示',
            },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'recall_memory',
        description: [
          '【强指令·只读·Mem-T】按关键词再检索本角色 Pack 长期记忆（已做章节门控）。',
          '当预置记忆不够、玩家追问往事、或需要核对某段设定时调用。',
          '不能写入/发明记忆；不能改章节；勿向玩家宣读系统原文清单。',
        ].join(''),
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '回忆查询短句（必填）',
            },
            top_k: {
              type: 'integer',
              description: '最多返回条数 1～5，默认 2',
            },
            reason: {
              type: 'string',
              description: '为何要再查记忆',
            },
          },
          required: ['query'],
        },
      },
    },
  ];
}
