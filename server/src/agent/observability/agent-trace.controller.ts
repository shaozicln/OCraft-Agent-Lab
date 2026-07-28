import {
  Controller,
  Delete,
  Get,
  Headers,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../../auth/auth.service';
import { AgentTraceService } from './agent-trace.service';

@Controller('agent')
export class AgentTraceController {
  constructor(
    private readonly authService: AuthService,
    private readonly traces: AgentTraceService,
  ) {}

  private requirePlayerId(authorization?: string): string {
    const token = authorization?.replace(/^Bearer\s+/i, '').trim();
    if (!token) throw new UnauthorizedException('Missing token');
    const verified = this.authService.verifyToken(token);
    if (!verified) throw new UnauthorizedException('Invalid token');
    return verified.playerId;
  }

  /** 最近决策 Trace（仅当前玩家；内存环形缓冲） */
  @Get('traces')
  list(
    @Headers('authorization') authorization: string | undefined,
    @Query('npcId') npcId?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const playerId = this.requirePlayerId(authorization);
    const limit = limitRaw ? Number(limitRaw) : 30;
    return {
      traces: this.traces.list({
        playerId,
        npcId: npcId || undefined,
        limit: Number.isFinite(limit) ? limit : 30,
      }),
    };
  }

  @Delete('traces')
  clear(@Headers('authorization') authorization: string | undefined) {
    const playerId = this.requirePlayerId(authorization);
    const removed = this.traces.clear(playerId);
    return { removed };
  }
}
