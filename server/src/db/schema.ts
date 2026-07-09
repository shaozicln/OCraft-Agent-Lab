/**
 * 数据库表定义（Drizzle ORM）
 *
 * 改表流程：
 * 1. 改本文件
 * 2. 同步 server/drizzle/0000_init.sql（或新增迁移）
 * 3. npm run db:migrate
 *
 * 表一览：
 * - players              玩家账号与资料（真名、网名、岗位等）
 * - player_npc_state     某玩家与某 NPC 的当前进度（好感、章节、对话缓存）
 * - story_flags          剧情节点是否已触发（阶段 C 启用，只升不降）
 * - conversation_archives 一次游戏会话的存档「文件」元数据
 * - conversation_snapshots 某次存档里的具体快照（消息 + NPC 状态）
 */
import {
  boolean,
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
  LlmMessage,
  PlayerExtra,
  PlayerGender,
} from '@ocraft/shared';

/** 玩家表：登录账号与游戏资料 */
export const players = pgTable(
  'players',
  {
    /** 玩家唯一 ID（服务端生成 UUID） */
    id: uuid('id').primaryKey(),
    /** 登录用户名（小写存储，全局唯一） */
    username: text('username'),
    /** scrypt 密码哈希，格式 salt:hash */
    passwordHash: text('password_hash'),
  /** 真名 / 公司用户名（工牌、协作软件显示名） */
  realName: text('real_name'),
  /** 游戏内网名（Steam、论坛等；剧情可吐槽「全网同名」） */
  onlineName: text('online_name'),
  /** 公司岗位（如前端、测试、运营） */
  jobTitle: text('job_title'),
  /** 性别：male | female | other | undisclosed */
  gender: text('gender').$type<PlayerGender | null>(),
  /** 年龄 */
  age: integer('age'),
  /** 生日，格式 YYYY-MM-DD */
  birthday: date('birthday', { mode: 'string' }),
  /** 玩家自填扩展资料 JSON（爱好、忌口等），默认空对象 */
  extra: jsonb('extra').$type<PlayerExtra>().notNull().default({}),
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
 * 玩家 × NPC 运行时状态
 * 一行 = 一个玩家对一个 NPC 的当前进度（刷新页面后从这里恢复）
 */
export const playerNpcState = pgTable(
  'player_npc_state',
  {
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id),
    /** NPC 标识，如 colleague_chenyu */
    npcId: text('npc_id').notNull(),
    /** 好感度 0–100 */
    affinity: integer('affinity').notNull(),
    /** 疲惫值 0–100 */
    fatigue: integer('fatigue').notNull(),
    /** 当前动画/状态，如 sleeping、talk、excited_talk */
    currentStatus: text('current_status').notNull(),
    /** 剧情章节：daily | uneasy | dream_reveal（只升不降） */
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
  (t) => [primaryKey({ columns: [t.playerId, t.npcId] })],
);

/**
 * 剧情 Flag（阶段 C 写入）
 * 如 ch1_bonded、ch3_dream_full；一旦 true 不可回退，只能读档恢复
 */
export const storyFlags = pgTable(
  'story_flags',
  {
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id),
    npcId: text('npc_id').notNull(),
    /** Flag 名称，见 Docs/Story/story-canon.md 附录 A */
    flagName: text('flag_name').notNull(),
    /** 是否已触发，默认 true（本表只记录已触发的 flag） */
    value: boolean('value').notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.npcId, t.flagName] })],
);

/**
 * 对话存档「会话」元数据
 * 类似以前的 20260708V1.json 文件名那一层
 */
export const conversationArchives = pgTable(
  'conversation_archives',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id),
    npcId: text('npc_id').notNull(),
    /** 展示用文件名，如 20260708V1.json */
    filename: text('filename').notNull(),
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
    /** 存档时 NPC 状态：好感、疲惫、章节等 */
    npcState: jsonb('npc_state').notNull().$type<ArchivedNpcState>(),
    /** 存档时的全部聊天消息 */
    messages: jsonb('messages').notNull().$type<ArchivedMessage[]>(),
  },
  (t) => [
    uniqueIndex('snapshots_archive_index_idx').on(
      t.archiveId,
      t.snapshotIndex,
    ),
  ],
);
