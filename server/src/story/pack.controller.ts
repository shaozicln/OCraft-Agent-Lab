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
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  formatAuthValidationError,
  packCreateWorldPayloadSchema,
  packForkPayloadSchema,
  packGenerateDraftPayloadSchema,
  packModerationPayloadSchema,
  packReactionPayloadSchema,
  packSaveAsPayloadSchema,
  packSeedPayloadSchema,
  packSelectPayloadSchema,
  packSetOfficialPayloadSchema,
  packShareVersionPayloadSchema,
  packShareWorldPayloadSchema,
  packUpdatePayloadSchema,
  packWorldListQuerySchema,
  storyPackSchema,
  type PackWorldSummary,
} from '@ocraft/shared';
import { AuthService } from '../auth/auth.service';
import { LlmService } from '../agent/core/llm.service';
import { isLoopbackOnly } from '../config/env';
import { CommunityPackService } from './community-pack.service';
import { PackService } from './pack.service';
import { PackGenerateService } from './pack-generate.service';
import { PackClarifyService } from './pack-clarify.service';
import { PackDistillService } from './pack-distill.service';
import { deleteWorldOnDisk } from './pack-ops';

@Controller('packs')
export class PackController {
  constructor(
    private readonly packService: PackService,
    private readonly community: CommunityPackService,
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

  /** 站点管理员（is_admin）；本机 loopback 开发时任意登录用户可当 admin */
  private async requireSiteAdmin(authorization?: string): Promise<string> {
    const playerId = this.requirePlayerId(authorization);
    if (await this.community.isAdmin(playerId)) return playerId;
    if (isLoopbackOnly()) return playerId;
    throw new ForbiddenException('需要管理员权限');
  }

  @Get('worlds')
  async listWorlds(
    @Headers('authorization') authorization?: string,
    @Query('q') q?: string,
    @Query('sort') sort?: string,
  ) {
    const playerId = this.requirePlayerId(authorization);
    let worlds = await this.packService.listWorldsForPlayer(playerId);
    const parsed = packWorldListQuerySchema.safeParse({ q, sort });
    const query = parsed.success ? parsed.data : { q: '', sort: 'default' as const };
    worlds = this.filterAndSortWorlds(worlds, query.q, query.sort);
    return { worlds, is_admin: await this.community.isAdmin(playerId) };
  }

  private filterAndSortWorlds(
    worlds: PackWorldSummary[],
    q: string,
    sort: 'default' | 'likes' | 'favorites' | 'name',
  ): PackWorldSummary[] {
    let list = worlds;
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((w) => {
        const hay = [
          w.short_name ?? '',
          w.world_id,
          w.owner_username ?? '',
          w.description ?? '',
        ]
          .join('\n')
          .toLowerCase();
        return hay.includes(needle);
      });
    }
    if (sort === 'default') return list;
    const copy = [...list];
    if (sort === 'likes') {
      copy.sort(
        (a, b) =>
          (b.like_count ?? 0) - (a.like_count ?? 0) ||
          (a.short_name ?? a.world_id).localeCompare(
            b.short_name ?? b.world_id,
            'zh',
          ),
      );
    } else if (sort === 'favorites') {
      copy.sort(
        (a, b) =>
          (b.favorite_count ?? 0) - (a.favorite_count ?? 0) ||
          (a.short_name ?? a.world_id).localeCompare(
            b.short_name ?? b.world_id,
            'zh',
          ),
      );
    } else if (sort === 'name') {
      copy.sort((a, b) =>
        (a.short_name ?? a.world_id).localeCompare(
          b.short_name ?? b.world_id,
          'zh',
        ),
      );
    }
    return copy;
  }

  @Get('worlds/:worldId/versions')
  async listVersions(
    @Headers('authorization') authorization: string | undefined,
    @Param('worldId') worldId: string,
  ) {
    const playerId = this.requirePlayerId(authorization);
    const worlds = await this.packService.listWorldsForPlayer(playerId);
    const world = worlds.find((w) => w.world_id === worldId);
    if (!world) {
      throw new BadRequestException(`未知世界: ${worldId}`);
    }
    return {
      world_id: world.world_id,
      short_name: world.short_name,
      official_version_dir: world.official_version_dir,
      description: world.description,
      versions: world.versions,
      owner_username: world.owner_username,
      forked_from_world_id: world.forked_from_world_id,
      forked_from_version_dirs: world.forked_from_version_dirs,
    };
  }

  @Get('worlds/:worldId/versions/:versionDir')
  async getVersion(
    @Headers('authorization') authorization: string | undefined,
    @Param('worldId') worldId: string,
    @Param('versionDir') versionDir: string,
  ) {
    const playerId = this.requirePlayerId(authorization);
    const ok = await this.community.canAccessVersion(
      playerId,
      worldId,
      versionDir,
    );
    if (!ok) {
      throw new ForbiddenException('无权访问该版本');
    }
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
    const playerId = this.requirePlayerId(authorization);
    await this.community.assertCanEditWorld(playerId, worldId);
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
    const playerId = this.requirePlayerId(authorization);
    await this.community.assertCanEditWorld(playerId, worldId);
    // 版本硬删仍走磁盘（MVP：版本不进回收站，只世界进站）
    const result = await this.packService.deleteVersion(worldId, versionDir);
    await this.community.deleteVersionMeta(worldId, versionDir);
    return result;
  }

  @Delete('worlds/:worldId')
  async deleteWorld(
    @Headers('authorization') authorization: string | undefined,
    @Param('worldId') worldId: string,
    @Query('purge') purge?: string,
  ) {
    const playerId = this.requirePlayerId(authorization);
    const isAdmin = await this.community.isAdmin(playerId);
    if (purge === '1' || purge === 'true') {
      if (!isAdmin) throw new ForbiddenException('仅管理员可彻底清空');
      const purged = await this.community.purgeWorldFromTrash(playerId, worldId);
      try {
        deleteWorldOnDisk(worldId);
      } catch {
        /* 磁盘可能已无 */
      }
      return purged;
    }
    // 自己删 → user 作用域；管理员删别人的 → admin（仅 admin 可恢复）
    const row = await this.community.getWorldRow(worldId);
    if (!row) throw new BadRequestException(`未知世界: ${worldId}`);
    const scope: 'user' | 'admin' =
      isAdmin && row.ownerPlayerId !== playerId ? 'admin' : 'user';
    return this.community.moveWorldToTrash(playerId, worldId, scope);
  }

  @Get('trash')
  async listTrash(@Headers('authorization') authorization?: string) {
    const playerId = this.requirePlayerId(authorization);
    return { items: await this.community.listTrash(playerId) };
  }

  @Post('trash/:worldId/restore')
  async restoreTrash(
    @Headers('authorization') authorization: string | undefined,
    @Param('worldId') worldId: string,
  ) {
    const playerId = this.requirePlayerId(authorization);
    return this.community.restoreWorldFromTrash(playerId, worldId);
  }

  @Post('seed')
  async seed(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const playerId = this.requirePlayerId(authorization);
    const parsed = packSeedPayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatAuthValidationError(parsed.error));
    }
    await this.community.assertCanEditWorld(playerId, parsed.data.worldId);
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
    const playerId = this.requirePlayerId(authorization);
    const parsed = packSaveAsPayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatAuthValidationError(parsed.error));
    }
    await this.community.assertCanEditWorld(playerId, parsed.data.worldId);
    const result = await this.packService.saveAs(parsed.data);
    await this.community.upsertVersionMeta({
      worldId: result.world_id,
      versionDir: result.version_dir,
      ownerPlayerId: playerId,
      isShared: false,
    });
    return result;
  }

  @Post('create-world')
  async createWorld(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const playerId = this.requirePlayerId(authorization);
    const parsed = packCreateWorldPayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatAuthValidationError(parsed.error));
    }
    return this.packService.createWorldForPlayer(playerId, parsed.data);
  }

  @Post('fork')
  async fork(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const playerId = this.requirePlayerId(authorization);
    const parsed = packForkPayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatAuthValidationError(parsed.error));
    }
    return this.packService.forkWorldForPlayer(playerId, parsed.data);
  }

  @Put('worlds/:worldId/share')
  async shareWorld(
    @Headers('authorization') authorization: string | undefined,
    @Param('worldId') worldId: string,
    @Body() body: unknown,
  ) {
    const playerId = this.requirePlayerId(authorization);
    const parsed = packShareWorldPayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatAuthValidationError(parsed.error));
    }
    return this.community.setWorldShared(
      playerId,
      worldId,
      parsed.data.isShared,
      parsed.data.ensureVersionDir,
    );
  }

  @Put('worlds/:worldId/versions/:versionDir/share')
  async shareVersion(
    @Headers('authorization') authorization: string | undefined,
    @Param('worldId') worldId: string,
    @Param('versionDir') versionDir: string,
    @Body() body: unknown,
  ) {
    const playerId = this.requirePlayerId(authorization);
    const parsed = packShareVersionPayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatAuthValidationError(parsed.error));
    }
    return this.community.setVersionShared(
      playerId,
      worldId,
      versionDir,
      parsed.data.isShared,
    );
  }

  @Put('worlds/:worldId/moderation')
  async moderateWorld(
    @Headers('authorization') authorization: string | undefined,
    @Param('worldId') worldId: string,
    @Body() body: unknown,
  ) {
    const adminId = await this.requireSiteAdmin(authorization);
    const parsed = packModerationPayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatAuthValidationError(parsed.error));
    }
    return this.community.setWorldModeration(
      adminId,
      worldId,
      parsed.data.status,
    );
  }

  @Put('worlds/:worldId/versions/:versionDir/moderation')
  async moderateVersion(
    @Headers('authorization') authorization: string | undefined,
    @Param('worldId') worldId: string,
    @Param('versionDir') versionDir: string,
    @Body() body: unknown,
  ) {
    const adminId = await this.requireSiteAdmin(authorization);
    const parsed = packModerationPayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatAuthValidationError(parsed.error));
    }
    return this.community.setVersionModeration(
      adminId,
      worldId,
      versionDir,
      parsed.data.status,
    );
  }

  @Put('worlds/:worldId/official')
  async setOfficial(
    @Headers('authorization') authorization: string | undefined,
    @Param('worldId') worldId: string,
    @Body() body: unknown,
  ) {
    const adminId = await this.requireSiteAdmin(authorization);
    const parsed = packSetOfficialPayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatAuthValidationError(parsed.error));
    }
    return this.community.setOfficial(
      adminId,
      worldId,
      parsed.data.isOfficial,
      parsed.data.afterCancel,
    );
  }

  @Put('worlds/:worldId/reaction')
  async reactWorld(
    @Headers('authorization') authorization: string | undefined,
    @Param('worldId') worldId: string,
    @Body() body: unknown,
  ) {
    const playerId = this.requirePlayerId(authorization);
    const parsed = packReactionPayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatAuthValidationError(parsed.error));
    }
    return this.community.setReaction(playerId, worldId, {
      target: parsed.data.target,
      versionDir: parsed.data.versionDir,
      kind: parsed.data.kind,
      active: parsed.data.active,
    });
  }

  @Post('generate-draft')
  async generateDraft(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const playerId = this.requirePlayerId(authorization);
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

  @Post('generate-draft/stream')
  async generateDraftStream(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Res() res: Response,
  ) {
    const playerId = this.requirePlayerId(authorization);
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
    const playerId = this.requirePlayerId(authorization);
    return this.llmService.runForPlayer(playerId, () =>
      this.packClarifyService.start(body),
    );
  }

  @Post('clarify/apply')
  async clarifyApply(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const playerId = this.requirePlayerId(authorization);
    return this.llmService.runForPlayer(playerId, () =>
      this.packClarifyService.apply(body),
    );
  }

  @Post('clarify/polish')
  async clarifyPolish(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const playerId = this.requirePlayerId(authorization);
    return this.llmService.runForPlayer(playerId, () =>
      this.packClarifyService.polish(body),
    );
  }

  @Post('distill/brief')
  async distillBrief(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const playerId = this.requirePlayerId(authorization);
    return this.llmService.runForPlayer(playerId, () =>
      this.packDistillService.brief(body),
    );
  }

  @Post('distill/normalize')
  async distillNormalize(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const playerId = this.requirePlayerId(authorization);
    return this.llmService.runForPlayer(playerId, async () =>
      this.packDistillService.normalize(body),
    );
  }

  @Post('distill/apply')
  async distillApply(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const playerId = this.requirePlayerId(authorization);
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
