import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Put,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import {
  authSessionSchema,
  formatAuthValidationError,
  patchMyAccountSchema,
  patchPlayerPackProfileSchema,
  playerAccountSchema,
  playerPackProfileSchema,
} from '@ocraft/shared';
import { AuthService } from './auth.service';
import { PlayerStateRepository } from '../db/player-state.repository';

@Controller('players')
export class PlayerController {
  constructor(
    private readonly authService: AuthService,
    private readonly playerStateRepo: PlayerStateRepository,
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

  /** 账号层：UID / 用户名 / 注册时间 */
  @Get('me')
  async me(@Headers('authorization') authorization?: string) {
    const playerId = this.requirePlayerId(authorization);
    await this.playerStateRepo.ensurePlayer(playerId);
    const account = await this.authService.getAccount(playerId);
    if (!account) {
      throw new BadRequestException('玩家账号不存在');
    }
    return playerAccountSchema.parse(account);
  }

  /** 改用户名 / 密码 */
  @Put('me/account')
  async updateAccount(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const playerId = this.requirePlayerId(authorization);
    const parsed = patchMyAccountSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatAuthValidationError(parsed.error));
    }
    const session = await this.authService.updateAccount(playerId, parsed.data);
    return authSessionSchema.parse(session);
  }

  /** 某 Pack 版本下的角色人设 */
  @Get('me/pack-profile')
  async getPackProfile(
    @Headers('authorization') authorization: string | undefined,
    @Query('worldId') worldId?: string,
    @Query('packVersionId') packVersionId?: string,
  ) {
    const playerId = this.requirePlayerId(authorization);
    if (!worldId?.trim() || !packVersionId?.trim()) {
      throw new BadRequestException('缺少 worldId 或 packVersionId');
    }
    const profile = await this.playerStateRepo.getPackProfile(
      playerId,
      worldId.trim(),
      packVersionId.trim(),
    );
    if (!profile) {
      throw new BadRequestException(
        'Database not available. Set DATABASE_URL and run npm run db:migrate.',
      );
    }
    return playerPackProfileSchema.parse(profile);
  }

  @Put('me/pack-profile')
  async updatePackProfile(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const playerId = this.requirePlayerId(authorization);
    const parsed = patchPlayerPackProfileSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatAuthValidationError(parsed.error));
    }
    const { worldId, packVersionId, ...patch } = parsed.data;
    const profile = await this.playerStateRepo.updatePackProfile(
      playerId,
      worldId,
      packVersionId,
      patch,
    );
    if (!profile) {
      throw new BadRequestException(
        'Database not available. Set DATABASE_URL and run npm run db:migrate.',
      );
    }
    return playerPackProfileSchema.parse(profile);
  }
}
