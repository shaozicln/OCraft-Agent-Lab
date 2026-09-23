/**
 * 数据库表定义（Drizzle ORM）
 *
 * 改表流程：
 * 1. 改本文件
 * 2. 同步 server/drizzle/0000_init.sql（或新增迁移）
 * 3. npm run db:migrate
 *
 * 表一览：
 * - players              玩家账号 + 选用 Pack + 个人 LLM 接口
 * - player_pack_profiles 某玩家在某包版本下的角色人设
 * - player_npc_state     某玩家在某包版本下与某 NPC 的当前进度
 * - story_flags          分人剧情 flag（L4 可选；世界主线见 world_flags）
 * - world_progress       共享世界章节（L2）
 * - world_flags          共享世界 flags（L2）
 * - story_pack_versions  seed 进库的包版本全文（JSONB）
 * - conversation_archives 一次游戏会话的存档「文件」元数据
 * - conversation_snapshots 某次存档里的具体快照（消息 + NPC 状态）
 */
import {
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type {
  ArchivedMessage,
  ArchivedNpcState,
  ChapterState,
  ConversationSnapshotPayload,
  LlmMessage,
  PlayerExtra,
  PlayerGender,
  StoryPack,
} from '@ocraft/shared';

/** 玩家表：登录账号 + 选用 Pack（角色人设见 player_pack_profiles） */
export const players = pgTable(
  'players',
  {
    /** 玩家 UID：三位数字，如 001（注册时顺序分配） */
    id: text('id').primaryKey(),
    /** 登录用户名（小写存储，全局唯一） */
    username: text('username'),
    /** scrypt 密码哈希，格式 salt:hash */
    passwordHash: text('password_hash'),
  /** 选用的世界；null = 跟随全服默认默认 */
  selectedWorldId: text('selected_world_id'),
  /** 选用的包版本目录名；null = 跟随全服默认默认 */
  selectedPackVersionId: text('selected_pack_version_id'),
  /** 玩家自填的 OpenAI 兼容 Base URL；空则回退 LLM_BASE_URL */
  llmBaseUrl: text('llm_base_url'),
  /** AES-GCM 加密后的 API Key；空则回退 LLM_API_KEY */
  llmApiKeyEnc: text('llm_api_key_enc'),
  llmModel: text('llm_model'),
  llmEmbedModel: text('llm_embed_model'),
  llmDirectorModel: text('llm_director_model'),
  /** 'true' | 'false'；null = 跟随 LLM_ENABLE_THINKING */
  llmEnableThinking: text('llm_enable_thinking'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  },
  (t) => [uniqueIndex('players_username_idx').on(t.username)],
);

/**
 * 玩家在某 Pack 版本下的角色人设（与进度一样按版本隔离）
 */
export const playerPackProfiles = pgTable(
  'player_pack_profiles',
  {
    playerId: text('player_id')
      .notNull()
      .references(() => players.id),
    worldId: text('world_id').notNull(),
    packVersionId: text('pack_version_id').notNull(),
    /** 真名 / 公司用户名 */
    realName: text('real_name'),
    /** 游戏内网名 */
    onlineName: text('online_name'),
    /** 公司岗位 */
    jobTitle: text('job_title'),
    gender: text('gender').$type<PlayerGender | null>(),
    age: integer('age'),
    birthday: date('birthday', { mode: 'string' }),
    /** 个人设定等扩展 JSON */
    extra: jsonb('extra').$type<PlayerExtra>().notNull().default({}),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.playerId, t.worldId, t.packVersionId],
      name: 'player_pack_profiles_pk',
    }),
  ],
);

/**
 * seed 进库的 Story Pack 版本（磁盘仍为真相源；库供运行时/面板）
 */
export const storyPackVersions = pgTable(
  'story_pack_versions',
  {
    worldId: text('world_id').notNull(),
    packVersionId: text('pack_version_id').notNull(),
    displayName: text('display_name').notNull(),
    createdAt: text('created_at').notNull(),
    notes: text('notes'),
    /** 完整 StoryPack JSON */
    packJson: jsonb('pack_json').notNull().$type<StoryPack>(),
    seededAt: timestamp('seeded_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.worldId, t.packVersionId],
      name: 'story_pack_versions_pk',
    }),
  ],
);

/**
 * 玩家 × Pack × NPC 运行时状态
 * 一行 = 某玩家在某包版本下对某 NPC 的当前进度（换包不串档）
 */
export const playerNpcState = pgTable(
  'player_npc_state',
  {
    playerId: text('player_id')
      .notNull()
      .references(() => players.id),
    /** Story Pack 世界 ID，如 office */
    worldId: text('world_id').notNull(),
    /** 版本目录名，如 official-mvp__20260710T1045 */
    packVersionId: text('pack_version_id').notNull(),
    /** NPC 标识，如 colleague_chenyu */
    npcId: text('npc_id').notNull(),
    /** 好感度 0–100 */
    affinity: integer('affinity').notNull(),
    /** 疲惫值 0–100 */
    fatigue: integer('fatigue').notNull(),
    /** 当前动画/状态，如 sleeping、talk、excited_talk */
    currentStatus: text('current_status').notNull(),
    /** 剧情章节 id（由 Pack 声明，只升不降） */
    chapterState: text('chapter_state').notNull().$type<ChapterState>(),
    /** 最近几轮对话，供 LLM 当上下文（约 6 轮） */
    recentMessages: jsonb('recent_messages')
      .notNull()
      .$type<LlmMessage[]>()
      .default([]),
    /** 本会话完整聊天记录（用于手动存档） */
    transcriptMessages: jsonb('transcript_messages')
      .notNull()
      .$type<ArchivedMessage[]>()
      .default([]),
    /** 当前会话开始时间 */
    sessionStartedAt: timestamp('session_started_at', { withTimezone: true }),
    /** 若本会话已存过档，对应 conversation_archives.filename */
    activeArchiveFilename: text('active_archive_filename'),
  },
  (t) => [
    primaryKey({
      columns: [t.playerId, t.worldId, t.packVersionId, t.npcId],
      name: 'player_npc_state_pk',
    }),
  ],
);

/**
 * 剧情 Flag（按 Pack 隔离）
 * 普通 flag value = "true"；enum flag 为包内声明的枚举值
 * 一旦写入不可回退，只能读档整表恢复
 */
export const storyFlags = pgTable(
  'story_flags',
  {
    playerId: text('player_id')
      .notNull()
      .references(() => players.id),
    worldId: text('world_id').notNull(),
    packVersionId: text('pack_version_id').notNull(),
    npcId: text('npc_id').notNull(),
    /** Flag 名称，由当前 Pack 的 world.flags 声明 */
    flagName: text('flag_name').notNull(),
    /** 置位值：普通 flag 为 "true"；stance 为枚举字符串 */
    value: text('value').notNull().default('true'),
  },
  (t) => [
    primaryKey({
      columns: [t.playerId, t.worldId, t.packVersionId, t.npcId, t.flagName],
      name: 'story_flags_pk',
    }),
  ],
);

/**
 * 共享世界进度（L2）：玩家 × Pack 一条章；与 default_npc 解耦
 */
export const worldProgress = pgTable(
  'world_progress',
  {
    playerId: text('player_id')
      .notNull()
      .references(() => players.id),
    worldId: text('world_id').notNull(),
    packVersionId: text('pack_version_id').notNull(),
    chapterState: text('chapter_state').notNull().$type<ChapterState>(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.playerId, t.worldId, t.packVersionId],
      name: 'world_progress_pk',
    }),
  ],
);

/**
 * 共享世界 flags（L2）：无 npc_id；只升不降，读档 replaceAll
 */
export const worldFlags = pgTable(
  'world_flags',
  {
    playerId: text('player_id')
      .notNull()
      .references(() => players.id),
    worldId: text('world_id').notNull(),
    packVersionId: text('pack_version_id').notNull(),
    flagName: text('flag_name').notNull(),
    value: text('value').notNull().default('true'),
  },
  (t) => [
    primaryKey({
      columns: [t.playerId, t.worldId, t.packVersionId, t.flagName],
      name: 'world_flags_pk',
    }),
  ],
);

/**
 * 对话存档「会话」元数据
 * 类似以前的 20260708V1.json 文件名那一层
 */
export const conversationArchives = pgTable(
  'conversation_archives',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id),
    /** 焦点/创建 NPC；run 档仍可填默认进度 NPC 便于兼容 */
    npcId: text('npc_id').notNull(),
    /** run 档所属世界；旧 npc 档可空 */
    worldId: text('world_id'),
    /** run 档所属包版本；旧 npc 档可空 */
    packVersionId: text('pack_version_id'),
    /** run=一局世界；npc=旧单人会话 */
    scope: text('scope').notNull().default('npc').$type<'run' | 'npc'>(),
    /** 展示用文件名，如 20260708V1.json */
    filename: text('filename').notNull(),
    /** 玩家自定义存档名；空则 UI 用 filename */
    displayName: text('display_name'),
    sessionStartedAt: timestamp('session_started_at', {
      withTimezone: true,
    }).notNull(),
  },
  (t) => [
    uniqueIndex('archives_player_filename_idx').on(t.playerId, t.filename),
  ],
);

/**
 * 存档快照：某次「保存」时的完整状态
 * 一个 conversation_archives 下可有多个 snapshot（同会话多次存档）
 */
export const conversationSnapshots = pgTable(
  'conversation_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    archiveId: uuid('archive_id')
      .notNull()
      .references(() => conversationArchives.id, { onDelete: 'cascade' }),
    /** 在该存档文件内的序号，从 0 开始 */
    snapshotIndex: integer('snapshot_index').notNull(),
    savedAt: timestamp('saved_at', { withTimezone: true }).notNull(),
    /** 焦点 NPC 状态镜像（列表预览 / 旧档） */
    npcState: jsonb('npc_state').notNull().$type<ArchivedNpcState>(),
    /** 焦点 NPC 聊天镜像 */
    messages: jsonb('messages').notNull().$type<ArchivedMessage[]>(),
    /** schema_version=3 一局全文（含 scene_log）；空则按旧 npc_state+messages */
    payload: jsonb('payload').$type<ConversationSnapshotPayload | null>(),
  },
  (t) => [
    uniqueIndex('snapshots_archive_index_idx').on(
      t.archiveId,
      t.snapshotIndex,
    ),
  ],
);
