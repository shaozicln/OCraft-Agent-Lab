-- 一局一档：存档元数据带 world/pack/scope；快照可挂 payload（v2 完整局数据）
ALTER TABLE "conversation_archives"
  ADD COLUMN IF NOT EXISTS "world_id" text,
  ADD COLUMN IF NOT EXISTS "pack_version_id" text,
  ADD COLUMN IF NOT EXISTS "scope" text NOT NULL DEFAULT 'npc';

COMMENT ON COLUMN "conversation_archives"."scope" IS 'run=一局世界档；npc=旧版单人会话档';
COMMENT ON COLUMN "conversation_archives"."world_id" IS '所属世界；run 档必填，旧 npc 档可空';
COMMENT ON COLUMN "conversation_archives"."pack_version_id" IS '所属包版本目录名；run 档必填，旧 npc 档可空';

ALTER TABLE "conversation_snapshots"
  ADD COLUMN IF NOT EXISTS "payload" jsonb;

COMMENT ON COLUMN "conversation_snapshots"."payload" IS 'schema_version=2 的一局快照全文；空则按旧 npc_state+messages 解读';
