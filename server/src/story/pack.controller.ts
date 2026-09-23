import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { LlmService } from '../agent/core/llm.service';
import { bindHost, isLoopbackOnly, packAdminIds } from '../config/env';
import { PackService } from './pack.service';
import { PackGenerateService } from './pack-generate.service';
import { PackClarifyService } from './pack-clarify.service';
import { PackDistillService } from './pack-distill.service';

@Controller('packs')
export class PackController {
  constructor(
    private readonly packService: PackService,
    private readonly packGenerateService: PackGenerateService,
    private readonly packClarifyService: PackClarifyService,
    private readonly packDistillService: PackDistillService,
    private readonly authService: AuthService,
    private readonly llmService: LlmService,
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

  /**
   * 剧情包写操作 / AI 生成类接口的准入检查。
   *
   * 这些操作的影响范围是「全局」而不是「当前玩家」：覆写或删除某个版本会连带
   * 清掉该版本下所有玩家的进度与人设（见 PackService.deleteProgressRows），
   * AI 生成类接口则直接消耗服务端的模型额度。所以不能只校验「你是一个合法玩家」。
   *
   * 策略：
   * - 仅监听本机（默认 BIND_HOST=127.0.0.1）时，本机用户即管理员，无需配置；
   * - 一旦 BIND_HOST 指向外部地址，就必须显式配置 PACK_ADMIN_IDS，否则一律拒绝（fail-closed）。
   */
  private requirePackAdmin(authorization?: string): string {
    const playerId = this.requirePlayerId(authorization);
    const admins = packAdminIds();

    if (admins.length === 0) {
      if (isLoopbackOnly()) return playerId;
      throw new ForbiddenException(
        `服务已对外监听（BIND_HOST=${bindHost()}）但未配置 PACK_ADMIN_IDS，` +
          '为避免影响其他玩家，已拒绝剧情包写操作与 AI 生成请求。',
      );
    }

    if (!admins.includes(playerId)) {
      throw new ForbiddenException(
        `玩家 ${playerId} 不在 PACK_ADMIN_IDS 白名单中，无权修改剧情包`,
      );
    }
    return playerId;
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
    this.requirePackAdmin(authorization);
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
    this.requirePackAdmin(authorization);
    return this.packService.deleteVersion(worldId, versionDir);
  }

  @Delete('worlds/:worldId')
  async deleteWorld(
    @Headers('authorization') authorization: string | undefined,
    @Param('worldId') worldId: string,
  ) {
    this.requirePackAdmin(authorization);
    return this.packService.deleteWorld(worldId);
  }

  @Post('seed')
  async seed(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    this.requirePackAdmin(authorization);
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
    this.requirePackAdmin(authorization);
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
    this.requirePackAdmin(authorization);
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
    const playerId = this.requirePackAdmin(authorization);
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
    const result = await this.llmService.runForPlayer(playerId, () =>
      this.packGenerateService.generateDraft({
        prompt: parsed.data.prompt,
        outline: parsed.data.outline,
        basePack: baseParsed.data,
        sections: parsed.data.sections,
      }),
    );
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
    const playerId = this.requirePackAdmin(authorization);
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
      await this.llmService.runForPlayer(playerId, async () => {
        for await (const ev of this.packGenerateService.generateDraftStream({
          prompt: parsed.data.prompt,
          outline: parsed.data.outline,
          basePack: baseParsed.data,
          sections: parsed.data.sections,
        })) {
          write(ev);
          if (ev.type === 'error') break;
        }
      });
    } catch (err) {
      write({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
    res.end();
  }

  @Post('clarify/start')
  async clarifyStart(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const playerId = this.requirePackAdmin(authorization);
    return this.llmService.runForPlayer(playerId, () =>
      this.packClarifyService.start(body),
    );
  }

  @Post('clarify/apply')
  async clarifyApply(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const playerId = this.requirePackAdmin(authorization);
    return this.llmService.runForPlayer(playerId, () =>
      this.packClarifyService.apply(body),
    );
  }

  @Post('clarify/polish')
  async clarifyPolish(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const playerId = this.requirePackAdmin(authorization);
    return this.llmService.runForPlayer(playerId, () =>
      this.packClarifyService.polish(body),
    );
  }

  @Post('distill/brief')
  async distillBrief(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const playerId = this.requirePackAdmin(authorization);
    return this.llmService.runForPlayer(playerId, () =>
      this.packDistillService.brief(body),
    );
  }

  @Post('distill/normalize')
  async distillNormalize(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const playerId = this.requirePackAdmin(authorization);
    return this.llmService.runForPlayer(playerId, async () =>
      this.packDistillService.normalize(body),
    );
  }

  @Post('distill/apply')
  async distillApply(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const playerId = this.requirePackAdmin(authorization);
    return this.llmService.runForPlayer(playerId, async () =>
      this.packDistillService.apply(body),
    );
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
