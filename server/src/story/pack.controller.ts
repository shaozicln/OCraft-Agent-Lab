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
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  formatAuthValidationError,
  packCreateWorldPayloadSchema,
  packGenerateDraftPayloadSchema,
  packSaveAsPayloadSchema,
  packSeedPayloadSchema,
  packSelectPayloadSchema,
  packUpdatePayloadSchema,
  storyPackSchema,
} from '@ocraft/shared';
import { AuthService } from '../auth/auth.service';
import { PackService } from './pack.service';
import { PackGenerateService } from './pack-generate.service';

@Controller('packs')
export class PackController {
  constructor(
    private readonly packService: PackService,
    private readonly packGenerateService: PackGenerateService,
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

  /** 一句话生成 Pack 草稿（仅返回，不落盘） */
  @Post('generate-draft')
  async generateDraft(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    this.requirePlayerId(authorization);
    const parsed = packGenerateDraftPayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatAuthValidationError(parsed.error));
    }
    const baseParsed = storyPackSchema.safeParse(parsed.data.basePack);
    if (!baseParsed.success) {
      throw new BadRequestException(
        `basePack 无效：${formatAuthValidationError(baseParsed.error)}`,
      );
    }
    const result = await this.packGenerateService.generateDraft({
      prompt: parsed.data.prompt,
      basePack: baseParsed.data,
      sections: parsed.data.sections,
    });
    return {
      pack: result.pack,
      source: result.source,
      profileFields: result.profileFields,
    };
  }

  /** 按 section 串行生成（SSE）；事件：section_start / section_done / error / done */
  @Post('generate-draft/stream')
  async generateDraftStream(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Res() res: Response,
  ) {
    this.requirePlayerId(authorization);
    const parsed = packGenerateDraftPayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatAuthValidationError(parsed.error));
    }
    const baseParsed = storyPackSchema.safeParse(parsed.data.basePack);
    if (!baseParsed.success) {
      throw new BadRequestException(
        `basePack 无效：${formatAuthValidationError(baseParsed.error)}`,
      );
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const write = (data: unknown) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      for await (const ev of this.packGenerateService.generateDraftStream({
        prompt: parsed.data.prompt,
        basePack: baseParsed.data,
        sections: parsed.data.sections,
      })) {
        write(ev);
        if (ev.type === 'error') break;
      }
    } catch (err) {
      write({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
    res.end();
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
