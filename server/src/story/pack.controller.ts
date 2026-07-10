import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  UnauthorizedException,
} from '@nestjs/common';
import {
  formatAuthValidationError,
  packCreateWorldPayloadSchema,
  packSaveAsPayloadSchema,
  packSeedPayloadSchema,
  packSelectPayloadSchema,
  packUpdatePayloadSchema,
} from '@ocraft/shared';
import { AuthService } from '../auth/auth.service';
import { PackService } from './pack.service';

@Controller('packs')
export class PackController {
  constructor(
    private readonly packService: PackService,
    private readonly authService: AuthService,
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

  @Get('worlds')
  listWorlds() {
    return { worlds: this.packService.listWorlds() };
  }

  @Get('worlds/:worldId/versions')
  listVersions(@Param('worldId') worldId: string) {
    const world = this.packService
      .listWorlds()
      .find((w) => w.world_id === worldId);
    if (!world) {
      throw new BadRequestException(`未知世界: ${worldId}`);
    }
    return {
      world_id: world.world_id,
      official_version_dir: world.official_version_dir,
      description: world.description,
      versions: world.versions,
    };
  }

  @Get('worlds/:worldId/versions/:versionDir')
  async getVersion(
    @Headers('authorization') authorization: string | undefined,
    @Param('worldId') worldId: string,
    @Param('versionDir') versionDir: string,
  ) {
    this.requirePlayerId(authorization);
    const pack = await this.packService.getVersionPack(worldId, versionDir);
    return { pack };
  }

  @Put('worlds/:worldId/versions/:versionDir')
  async putVersion(
    @Headers('authorization') authorization: string | undefined,
    @Param('worldId') worldId: string,
    @Param('versionDir') versionDir: string,
    @Body() body: unknown,
  ) {
    this.requirePlayerId(authorization);
    const parsed = packUpdatePayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatAuthValidationError(parsed.error));
    }
    const pack = await this.packService.updateVersionPack(
      worldId,
      versionDir,
      parsed.data.pack,
    );
    return {
      world_id: pack.header.world_id,
      version_dir: pack.version_dir,
      version_name: pack.header.display_name,
      pack,
    };
  }

  @Delete('worlds/:worldId/versions/:versionDir')
  async deleteVersion(
    @Headers('authorization') authorization: string | undefined,
    @Param('worldId') worldId: string,
    @Param('versionDir') versionDir: string,
  ) {
    this.requirePlayerId(authorization);
    return this.packService.deleteVersion(worldId, versionDir);
  }

  @Delete('worlds/:worldId')
  async deleteWorld(
    @Headers('authorization') authorization: string | undefined,
    @Param('worldId') worldId: string,
  ) {
    this.requirePlayerId(authorization);
    return this.packService.deleteWorld(worldId);
  }

  @Post('seed')
  async seed(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    this.requirePlayerId(authorization);
    const parsed = packSeedPayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatAuthValidationError(parsed.error));
    }
    return this.packService.seedVersion(
      parsed.data.worldId,
      parsed.data.versionDir,
    );
  }

  @Post('save-as')
  async saveAs(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    this.requirePlayerId(authorization);
    const parsed = packSaveAsPayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatAuthValidationError(parsed.error));
    }
    return this.packService.saveAs(parsed.data);
  }

  @Post('create-world')
  async createWorld(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    this.requirePlayerId(authorization);
    const parsed = packCreateWorldPayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatAuthValidationError(parsed.error));
    }
    return this.packService.createWorld(parsed.data);
  }

  @Get('selection')
  async getSelection(@Headers('authorization') authorization?: string) {
    const playerId = this.requirePlayerId(authorization);
    return this.packService.getSelection(playerId);
  }

  @Get('runtime')
  async getRuntime(@Headers('authorization') authorization?: string) {
    const playerId = this.requirePlayerId(authorization);
    return this.packService.getRuntime(playerId);
  }

  @Put('selection')
  async putSelection(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const playerId = this.requirePlayerId(authorization);
    const parsed = packSelectPayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatAuthValidationError(parsed.error));
    }
    return this.packService.selectPack(
      playerId,
      parsed.data.worldId,
      parsed.data.packVersionId,
    );
  }

  @Delete('selection')
  async deleteSelection(@Headers('authorization') authorization?: string) {
    const playerId = this.requirePlayerId(authorization);
    return this.packService.clearSelection(playerId);
  }
}
