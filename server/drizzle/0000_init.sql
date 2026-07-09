-- =============================================================================
-- OCraft 数据库初始化（阶段 B）
-- 执行：cd server && npm run db:migrate
-- =============================================================================

-- -----------------------------------------------------------------------------
-- players：玩家账号与资料
-- 一行 = 一个玩家（id 与浏览器 localStorage 的 playerId 相同）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "players" (
  "id" uuid PRIMARY KEY NOT NULL,
  "real_name" text,
  "online_name" text,
  "job_title" text,
  "gender" text,
  "age" integer,
  "birthday" date,
  "extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE "players" IS '玩家表：账号 ID 与资料（真名、网名、岗位等）';
COMMENT ON COLUMN "players"."id" IS '玩家 UUID，与前端 localStorage ocraft_player_id 一致';
COMMENT ON COLUMN "players"."real_name" IS '真名 / 公司用户名（工牌、协作软件）';
COMMENT ON COLUMN "players"."online_name" IS '游戏内网名（Steam 等；剧情可吐槽全网同名）';
COMMENT ON COLUMN "players"."job_title" IS '公司岗位（前端、测试、运营等）';
COMMENT ON COLUMN "players"."gender" IS '性别：male | female | other | undisclosed';
COMMENT ON COLUMN "players"."age" IS '年龄';
COMMENT ON COLUMN "players"."birthday" IS '生日 YYYY-MM-DD';
COMMENT ON COLUMN "players"."extra" IS '玩家自填扩展 JSON（爱好、忌口等）';
COMMENT ON COLUMN "players"."created_at" IS '记录创建时间';
COMMENT ON COLUMN "players"."updated_at" IS '资料最后更新时间';

-- -----------------------------------------------------------------------------
-- player_npc_state：玩家对某个 NPC 的当前游戏进度
-- 主键 (player_id, npc_id)；刷新页面后从这里恢复好感、章节、对话
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "player_npc_state" (
  "player_id" uuid NOT NULL REFERENCES "players"("id"),
  "npc_id" text NOT NULL,
  "affinity" integer NOT NULL,
  "fatigue" integer NOT NULL,
  "current_status" text NOT NULL,
  "chapter_state" text DEFAULT 'daily' NOT NULL,
  "recent_messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "transcript_messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "session_started_at" timestamp with time zone,
  "active_archive_filename" text,
  CONSTRAINT "player_npc_state_player_id_npc_id_pk" PRIMARY KEY("player_id","npc_id")
);

COMMENT ON TABLE "player_npc_state" IS '玩家×NPC 运行时状态（好感、疲惫、章节、对话缓存）';
COMMENT ON COLUMN "player_npc_state"."player_id" IS '玩家 ID';
COMMENT ON COLUMN "player_npc_state"."npc_id" IS 'NPC 标识，如 colleague_chenyu';
COMMENT ON COLUMN "player_npc_state"."affinity" IS '好感度 0-100';
COMMENT ON COLUMN "player_npc_state"."fatigue" IS '疲惫值 0-100';
COMMENT ON COLUMN "player_npc_state"."current_status" IS '动画状态：sleeping、talk、excited_talk 等';
COMMENT ON COLUMN "player_npc_state"."chapter_state" IS '剧情章节：daily | uneasy | dream_reveal';
COMMENT ON COLUMN "player_npc_state"."recent_messages" IS '最近几轮对话 JSON，供 LLM 上下文';
COMMENT ON COLUMN "player_npc_state"."transcript_messages" IS '本会话完整聊天记录，用于手动存档';
COMMENT ON COLUMN "player_npc_state"."session_started_at" IS '当前会话开始时间';
COMMENT ON COLUMN "player_npc_state"."active_archive_filename" IS '本会话关联的存档文件名（若有）';

-- -----------------------------------------------------------------------------
-- story_flags：剧情节点（阶段 C 启用）
-- 如 ch1_bonded；只记录已触发的 flag，不可回退
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "story_flags" (
  "player_id" uuid NOT NULL REFERENCES "players"("id"),
  "npc_id" text NOT NULL,
  "flag_name" text NOT NULL,
  "value" boolean DEFAULT true NOT NULL,
  CONSTRAINT "story_flags_player_id_npc_id_flag_name_pk" PRIMARY KEY("player_id","npc_id","flag_name")
);

COMMENT ON TABLE "story_flags" IS '剧情 Flag：记录已触发的剧情节点（见 story-canon 附录 A）';
COMMENT ON COLUMN "story_flags"."player_id" IS '玩家 ID';
COMMENT ON COLUMN "story_flags"."npc_id" IS 'NPC 标识';
COMMENT ON COLUMN "story_flags"."flag_name" IS 'Flag 名，如 ch3_dream_full';
COMMENT ON COLUMN "story_flags"."value" IS '是否已触发，默认 true';

-- -----------------------------------------------------------------------------
-- conversation_archives：一次游戏会话的存档「文件」
-- 类似以前的 20260708V1.json 这一层
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "conversation_archives" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" uuid NOT NULL REFERENCES "players"("id"),
  "npc_id" text NOT NULL,
  "filename" text NOT NULL,
  "session_started_at" timestamp with time zone NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "archives_player_filename_idx" ON "conversation_archives" ("player_id","filename");

COMMENT ON TABLE "conversation_archives" IS '对话存档会话元数据（一个「存档文件」）';
COMMENT ON COLUMN "conversation_archives"."id" IS '存档记录内部 UUID';
COMMENT ON COLUMN "conversation_archives"."player_id" IS '所属玩家';
COMMENT ON COLUMN "conversation_archives"."npc_id" IS '对话对象 NPC';
COMMENT ON COLUMN "conversation_archives"."filename" IS '展示文件名，如 20260708V1.json';
COMMENT ON COLUMN "conversation_archives"."session_started_at" IS '该会话开始时间';

-- -----------------------------------------------------------------------------
-- conversation_snapshots：存档里的每一次「保存」快照
-- 一个 archive 下可有多个 snapshot（同会话多次点保存）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "conversation_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "archive_id" uuid NOT NULL REFERENCES "conversation_archives"("id") ON DELETE cascade,
  "snapshot_index" integer NOT NULL,
  "saved_at" timestamp with time zone NOT NULL,
  "npc_state" jsonb NOT NULL,
  "messages" jsonb NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "snapshots_archive_index_idx" ON "conversation_snapshots" ("archive_id","snapshot_index");

COMMENT ON TABLE "conversation_snapshots" IS '存档快照：某次保存时的消息列表与 NPC 状态';
COMMENT ON COLUMN "conversation_snapshots"."id" IS '快照内部 UUID';
COMMENT ON COLUMN "conversation_snapshots"."archive_id" IS '所属 conversation_archives.id';
COMMENT ON COLUMN "conversation_snapshots"."snapshot_index" IS '在该存档内的序号，从 0 开始';
COMMENT ON COLUMN "conversation_snapshots"."saved_at" IS '保存时间';
COMMENT ON COLUMN "conversation_snapshots"."npc_state" IS '存档时好感、疲惫、章节等 JSON';
COMMENT ON COLUMN "conversation_snapshots"."messages" IS '存档时全部聊天消息 JSON';
