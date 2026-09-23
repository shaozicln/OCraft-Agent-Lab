import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Put,
  UnauthorizedException,
} from '@nestjs/common';
import {
  formatAuthValidationError,
  llmTestResultSchema,
  patchPlayerLlmSettingsSchema,
  playerLlmSettingsSchema,
  testPlayerLlmSettingsSchema,
} from '@ocraft/shared';
import { AuthService } from '../auth/auth.service';
import { LlmService } from './core/llm.service';
import { LlmSettingsService } from './core/llm-settings.service';

@Controller('players/me/llm')
export class LlmSettingsController {
  constructor(
    private readonly authService: AuthService,
    private readonly settings: LlmSettingsService,
    private readonly llm: LlmService,
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

  @Get()
  async get(@Headers('authorization') authorization?: string) {
    const playerId = this.requirePlayerId(authorization);
    return playerLlmSettingsSchema.parse(await this.settings.getPublic(playerId));
  }

  @Put()
  async update(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const playerId = this.requirePlayerId(authorization);
    const parsed = patchPlayerLlmSettingsSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatAuthValidationError(parsed.error));
    }
    try {
      const previous = await this.settings.resolve(playerId);
      const next = playerLlmSettingsSchema.parse(
        await this.settings.update(playerId, parsed.data),
      );
      if (previous.source === 'player') {
        this.llm.dropClientFor(previous);
      }
      return next;
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : '保存失败',
      );
    }
  }

  /** 用当前保存值（可带未保存草稿覆盖）打一次极短补全 */
  @Post('test')
  async test(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const playerId = this.requirePlayerId(authorization);
    const parsed = testPlayerLlmSettingsSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(formatAuthValidationError(parsed.error));
    }
    const config = await this.settings.resolveWithPatch(playerId, parsed.data);
    if (!config.apiKey || !config.baseURL) {
      throw new BadRequestException('请填写 API Key 与 Base URL 后再测试');
    }
    try {
      const preview = await this.llm.runWithConfig(config, () =>
        this.llm.complete([{ role: 'user', content: 'ping' }], {
          maxTokens: 8,
          temperature: 0,
        }),
      );
      return llmTestResultSchema.parse({
        ok: true,
        model: config.model,
        preview: preview.slice(0, 120),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(message);
    } finally {
      // 测试用草稿 Key 不落库，测完即丢弃缓存，避免临时 Key 常驻内存
      this.llm.dropClientFor(config);
    }
  }
}
