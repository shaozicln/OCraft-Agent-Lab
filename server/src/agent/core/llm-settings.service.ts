import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type {
  PatchPlayerLlmSettings,
  PlayerLlmSettings,
} from '@ocraft/shared';
import { allowEnvLlmFallback, requireAuthSecret } from '../../config/env';
import { DbService } from '../../db/db.service';
import { players } from '../../db/schema';
import { decryptSecret, encryptSecret, maskApiKey } from './llm-secret';
import type { ResolvedLlmConfig } from './llm.types';

type PlayerLlmRow = {
  llmBaseUrl: string | null;
  llmApiKeyEnc: string | null;
  llmModel: string | null;
  llmEmbedModel: string | null;
  llmDirectorModel: string | null;
  llmEnableThinking: string | null;
};

function trimOrEmpty(v: string | null | undefined): string {
  return (v ?? '').trim();
}

export function envLlmConfig(): ResolvedLlmConfig {
  const apiKey = trimOrEmpty(process.env.LLM_API_KEY);
  const baseURL = trimOrEmpty(process.env.LLM_BASE_URL);
  const model = trimOrEmpty(process.env.LLM_MODEL) || 'qwen-plus';
  const embedModel =
    trimOrEmpty(process.env.LLM_EMBED_MODEL) ||
    trimOrEmpty(process.env.EMBEDDING_MODEL) ||
    'text-embedding-v3';
  const directorModel = trimOrEmpty(process.env.DIRECTOR_MODEL) || model;
  const enableThinking = process.env.LLM_ENABLE_THINKING === 'true';
  return {
    apiKey,
    baseURL,
    model,
    embedModel,
    directorModel,
    enableThinking,
    source: apiKey && baseURL ? 'env' : 'none',
  };
}

@Injectable()
export class LlmSettingsService {
  private readonly logger = new Logger(LlmSettingsService.name);

  constructor(private readonly dbService: DbService) {}

  private secret(): string {
    return requireAuthSecret();
  }

  private decryptKey(enc: string | null): string {
    const raw = trimOrEmpty(enc);
    if (!raw) return '';
    const plain = decryptSecret(raw, this.secret());
    if (plain == null) {
      this.logger.warn('stored LLM API key could not be decrypted');
      return '';
    }
    return plain;
  }

  private async readRow(playerId: string): Promise<PlayerLlmRow | null> {
    if (!this.dbService.isReady) return null;
    const rows = await this.dbService.db
      .select({
        llmBaseUrl: players.llmBaseUrl,
        llmApiKeyEnc: players.llmApiKeyEnc,
        llmModel: players.llmModel,
        llmEmbedModel: players.llmEmbedModel,
        llmDirectorModel: players.llmDirectorModel,
        llmEnableThinking: players.llmEnableThinking,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);
    return rows[0] ?? null;
  }

  resolveFromParts(
    player: {
      apiKey: string;
      baseUrl: string;
      model: string;
      embedModel: string;
      directorModel: string;
      enableThinking: boolean | null;
    },
    env = envLlmConfig(),
  ): ResolvedLlmConfig {
    const useEnvKey = allowEnvLlmFallback();
    const apiKey = player.apiKey || (useEnvKey ? env.apiKey : '');
    const baseURL = player.baseUrl || (useEnvKey ? env.baseURL : '');
    // 模型名仍可继承 .env 默认，不消耗额度
    const model = player.model || env.model;
    const embedModel = player.embedModel || env.embedModel;
    const directorModel = player.directorModel || env.directorModel || model;
    const enableThinking =
      player.enableThinking == null ? env.enableThinking : player.enableThinking;
    let source: ResolvedLlmConfig['source'] = 'none';
    if (apiKey && baseURL) {
      source = player.apiKey ? 'player' : 'env';
    }
    return {
      apiKey,
      baseURL,
      model,
      embedModel,
      directorModel,
      enableThinking,
      source,
    };
  }

  async resolve(playerId: string): Promise<ResolvedLlmConfig> {
    const env = envLlmConfig();
    const row = await this.readRow(playerId);
    if (!row) return env;
    return this.resolveFromParts(
      {
        apiKey: this.decryptKey(row.llmApiKeyEnc),
        baseUrl: trimOrEmpty(row.llmBaseUrl),
        model: trimOrEmpty(row.llmModel),
        embedModel: trimOrEmpty(row.llmEmbedModel),
        directorModel: trimOrEmpty(row.llmDirectorModel),
        enableThinking:
          row.llmEnableThinking == null
            ? null
            : row.llmEnableThinking === 'true',
      },
      env,
    );
  }

  async resolveWithPatch(
    playerId: string,
    patch: PatchPlayerLlmSettings,
  ): Promise<ResolvedLlmConfig> {
    const env = envLlmConfig();
    const row = await this.readRow(playerId);
    let apiKey = this.decryptKey(row?.llmApiKeyEnc ?? null);
    if (patch.clearApiKey) apiKey = '';
    else if (trimOrEmpty(patch.apiKey)) apiKey = patch.apiKey!.trim();

    const thinkingPatch =
      patch.enableThinking === undefined
        ? row?.llmEnableThinking == null
          ? null
          : row.llmEnableThinking === 'true'
        : patch.enableThinking;

    return this.resolveFromParts(
      {
        apiKey,
        baseUrl:
          patch.baseUrl !== undefined
            ? trimOrEmpty(patch.baseUrl)
            : trimOrEmpty(row?.llmBaseUrl),
        model:
          patch.model !== undefined
            ? trimOrEmpty(patch.model)
            : trimOrEmpty(row?.llmModel),
        embedModel:
          patch.embedModel !== undefined
            ? trimOrEmpty(patch.embedModel)
            : trimOrEmpty(row?.llmEmbedModel),
        directorModel:
          patch.directorModel !== undefined
            ? trimOrEmpty(patch.directorModel)
            : trimOrEmpty(row?.llmDirectorModel),
        enableThinking: thinkingPatch,
      },
      env,
    );
  }

  async getPublic(playerId: string): Promise<PlayerLlmSettings> {
    const row = await this.readRow(playerId);
    const apiKey = this.decryptKey(row?.llmApiKeyEnc ?? null);
    const stored = {
      apiKey,
      baseUrl: trimOrEmpty(row?.llmBaseUrl),
      model: trimOrEmpty(row?.llmModel),
      embedModel: trimOrEmpty(row?.llmEmbedModel),
      directorModel: trimOrEmpty(row?.llmDirectorModel),
      enableThinking:
        row?.llmEnableThinking == null
          ? null
          : row.llmEnableThinking === 'true',
    };
    const effective = this.resolveFromParts(stored);
    return {
      baseUrl: stored.baseUrl,
      model: stored.model,
      embedModel: stored.embedModel,
      directorModel: stored.directorModel,
      enableThinking: stored.enableThinking,
      hasApiKey: Boolean(stored.apiKey),
      apiKeyMasked: maskApiKey(stored.apiKey),
      effective: {
        source: effective.source,
        baseUrl: effective.baseURL,
        model: effective.model,
        mock: effective.source === 'none',
      },
    };
  }

  async update(
    playerId: string,
    patch: PatchPlayerLlmSettings,
  ): Promise<PlayerLlmSettings> {
    if (!this.dbService.isReady) {
      throw new Error(
        'Database not available. Set DATABASE_URL and run npm run db:migrate.',
      );
    }

    const set: Partial<typeof players.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (patch.baseUrl !== undefined) {
      set.llmBaseUrl = trimOrEmpty(patch.baseUrl) || null;
    }
    if (patch.clearApiKey) {
      set.llmApiKeyEnc = null;
    } else if (trimOrEmpty(patch.apiKey)) {
      set.llmApiKeyEnc = encryptSecret(patch.apiKey!.trim(), this.secret());
    }
    if (patch.model !== undefined) {
      set.llmModel = trimOrEmpty(patch.model) || null;
    }
    if (patch.embedModel !== undefined) {
      set.llmEmbedModel = trimOrEmpty(patch.embedModel) || null;
    }
    if (patch.directorModel !== undefined) {
      set.llmDirectorModel = trimOrEmpty(patch.directorModel) || null;
    }
    if (patch.enableThinking !== undefined) {
      set.llmEnableThinking =
        patch.enableThinking == null
          ? null
          : patch.enableThinking
            ? 'true'
            : 'false';
    }

    await this.dbService.db
      .update(players)
      .set(set)
      .where(eq(players.id, playerId));

    return this.getPublic(playerId);
  }
}
