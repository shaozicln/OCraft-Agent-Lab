import {
  Controller,
  Get,
  Headers,
  Param,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { PackService } from '../story/pack.service';
import { NpcService } from './npc.service';

@Controller('npc')
export class NpcController {
  constructor(
    private readonly npcService: NpcService,
    private readonly authService: AuthService,
    private readonly packService: PackService,
  ) {}

  private requirePlayerId(authorization?: string): string {
    const token = authorization?.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      throw new UnauthorizedException('Missing token');
    }
    const verified = this.authService.verifyToken(token);
    if (!verified) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return verified.playerId;
  }

  /** 按当前玩家选用的 Pack 查 NPC（无选用则测试包） */
  @Get(':id')
  async getNpc(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    const playerId = this.requirePlayerId(authorization);
    return this.packService.runWithPlayerAsync(playerId, async () =>
      this.npcService.getPublicProfile(id),
    );
  }
}
