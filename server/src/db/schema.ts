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

export const players = pgTable('players', {
  id: uuid('id').primaryKey(),
  /** 真名 / 公司用户名 */
  realName: text('real_name'),
  /** 游戏内网名（Steam、论坛等） */
  onlineName: text('online_name'),
  /** 公司岗位 */
  jobTitle: text('job_title'),
  gender: text('gender').$type<PlayerGender | null>(),
  age: integer('age'),
  birthday: date('birthday', { mode: 'string' }),
  extra: jsonb('extra').$type<PlayerExtra>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const playerNpcState = pgTable(
  'player_npc_state',
  {
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id),
    npcId: text('npc_id').notNull(),
    affinity: integer('affinity').notNull(),
    fatigue: integer('fatigue').notNull(),
    currentStatus: text('current_status').notNull(),
    chapterState: text('chapter_state').notNull().$type<ChapterState>(),
    recentMessages: jsonb('recent_messages')
      .notNull()
      .$type<LlmMessage[]>()
      .default([]),
    transcriptMessages: jsonb('transcript_messages')
      .notNull()
      .$type<ArchivedMessage[]>()
      .default([]),
    sessionStartedAt: timestamp('session_started_at', { withTimezone: true }),
    activeArchiveFilename: text('active_archive_filename'),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.npcId] })],
);

export const storyFlags = pgTable(
  'story_flags',
  {
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id),
    npcId: text('npc_id').notNull(),
    flagName: text('flag_name').notNull(),
    value: boolean('value').notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.npcId, t.flagName] })],
);

export const conversationArchives = pgTable(
  'conversation_archives',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id),
    npcId: text('npc_id').notNull(),
    filename: text('filename').notNull(),
    sessionStartedAt: timestamp('session_started_at', {
      withTimezone: true,
    }).notNull(),
  },
  (t) => [
    uniqueIndex('archives_player_filename_idx').on(t.playerId, t.filename),
  ],
);

export const conversationSnapshots = pgTable(
  'conversation_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    archiveId: uuid('archive_id')
      .notNull()
      .references(() => conversationArchives.id, { onDelete: 'cascade' }),
    snapshotIndex: integer('snapshot_index').notNull(),
    savedAt: timestamp('saved_at', { withTimezone: true }).notNull(),
    npcState: jsonb('npc_state').notNull().$type<ArchivedNpcState>(),
    messages: jsonb('messages').notNull().$type<ArchivedMessage[]>(),
  },
  (t) => [
    uniqueIndex('snapshots_archive_index_idx').on(
      t.archiveId,
      t.snapshotIndex,
    ),
  ],
);
