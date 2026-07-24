import { Injectable, Logger } from '@nestjs/common';
import type { AgentTraceRecord } from '@ocraft/shared';

const DEFAULT_CAPACITY = 80;

@Injectable()
export class AgentTraceService {
  private readonly logger = new Logger(AgentTraceService.name);
  private readonly capacity =
    Number(process.env.AGENT_TRACE_CAPACITY) || DEFAULT_CAPACITY;
  private readonly buffer: AgentTraceRecord[] = [];

  record(trace: AgentTraceRecord): void {
    this.buffer.push(trace);
    while (this.buffer.length > this.capacity) {
      this.buffer.shift();
    }
    this.logger.log(`[agent-trace] ${JSON.stringify(trace)}`);
  }

  /** 补记 NPC 回复后置 flag（挂到该玩家+NPC 最近一条） */
  appendReplyFlags(
    playerId: string,
    npcId: string,
    flags: Array<{ name: string; value: string }>,
  ): void {
    if (flags.length === 0) return;
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      const t = this.buffer[i];
      if (t.player_id === playerId && t.npc_id === npcId) {
        t.reply_flags_set = [...(t.reply_flags_set ?? []), ...flags];
        this.logger.log(
          `[agent-trace] reply_flags id=${t.id} ${JSON.stringify(flags)}`,
        );
        return;
      }
    }
  }

  /** 补记 F 安全扫描结果 */
  appendSafety(
    playerId: string,
    npcId: string,
    safety: {
      ok: boolean;
      rewritten?: boolean;
      reasons: Array<{ code: string; detail: string }>;
      traceId?: string;
    },
  ): void {
    const { traceId, ...payload } = safety;
    if (traceId) {
      const hit = this.buffer.find((t) => t.id === traceId);
      if (hit) {
        hit.safety = payload;
        return;
      }
    }
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      const t = this.buffer[i];
      if (t.player_id === playerId && t.npc_id === npcId) {
        t.safety = payload;
        return;
      }
    }
  }

  /** 补记关系事件互聊（优先挂到指定 traceId，否则最近一条） */
  appendExchange(
    playerId: string,
    npcId: string,
    exchange: {
      event_id: string;
      lines: Array<{ npc_id: string; name: string; text: string }>;
      traceId?: string;
    },
  ): void {
    const { traceId, ...payload } = exchange;
    if (traceId) {
      const hit = this.buffer.find((t) => t.id === traceId);
      if (hit) {
        hit.exchange = payload;
        this.logger.log(
          `[agent-trace] exchange id=${hit.id} event=${payload.event_id}`,
        );
        return;
      }
    }
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      const t = this.buffer[i];
      if (t.player_id === playerId && t.npc_id === npcId) {
        t.exchange = payload;
        this.logger.log(
          `[agent-trace] exchange id=${t.id} event=${payload.event_id}`,
        );
        return;
      }
    }
    this.logger.warn(
      `[agent-trace] exchange orphan player=${playerId} event=${payload.event_id}`,
    );
  }

  list(opts: {
    playerId?: string;
    npcId?: string;
    limit?: number;
  } = {}): AgentTraceRecord[] {
    const limit = Math.min(Math.max(opts.limit ?? 30, 1), this.capacity);
    let rows = [...this.buffer].reverse();
    if (opts.playerId) {
      rows = rows.filter((t) => t.player_id === opts.playerId);
    }
    if (opts.npcId) {
      rows = rows.filter((t) => t.npc_id === opts.npcId);
    }
    return rows.slice(0, limit);
  }

  clear(playerId?: string): number {
    if (!playerId) {
      const n = this.buffer.length;
      this.buffer.length = 0;
      return n;
    }
    let removed = 0;
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      if (this.buffer[i].player_id === playerId) {
        this.buffer.splice(i, 1);
        removed++;
      }
    }
    return removed;
  }
}
