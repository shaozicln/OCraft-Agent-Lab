-- P0：进度按 world_id + pack_version_id 隔离，避免换包串档
-- 旧行迁到默认 office / official-mvp__20260710T1045

-- -----------------------------------------------------------------------------
-- player_npc_state
-- -----------------------------------------------------------------------------
ALTER TABLE "player_npc_state"
  ADD COLUMN IF NOT EXISTS "world_id" text,
  ADD COLUMN IF NOT EXISTS "pack_version_id" text;

UPDATE "player_npc_state"
SET
  "world_id" = COALESCE("world_id", 'office'),
  "pack_version_id" = COALESCE("pack_version_id", 'official-mvp__20260710T1045');

ALTER TABLE "player_npc_state"
  ALTER COLUMN "world_id" SET NOT NULL,
  ALTER COLUMN "pack_version_id" SET NOT NULL;

ALTER TABLE "player_npc_state"
  DROP CONSTRAINT IF EXISTS "player_npc_state_player_id_npc_id_pk";

ALTER TABLE "player_npc_state"
  ADD CONSTRAINT "player_npc_state_pk"
  PRIMARY KEY ("player_id", "world_id", "pack_version_id", "npc_id");

COMMENT ON COLUMN "player_npc_state"."world_id" IS 'Story Pack 世界 ID，如 office';
COMMENT ON COLUMN "player_npc_state"."pack_version_id" IS '版本目录名，如 official-mvp__20260710T1045';

-- -----------------------------------------------------------------------------
-- story_flags
-- -----------------------------------------------------------------------------
ALTER TABLE "story_flags"
  ADD COLUMN IF NOT EXISTS "world_id" text,
  ADD COLUMN IF NOT EXISTS "pack_version_id" text;

UPDATE "story_flags"
SET
  "world_id" = COALESCE("world_id", 'office'),
  "pack_version_id" = COALESCE("pack_version_id", 'official-mvp__20260710T1045');

ALTER TABLE "story_flags"
  ALTER COLUMN "world_id" SET NOT NULL,
  ALTER COLUMN "pack_version_id" SET NOT NULL;

ALTER TABLE "story_flags"
  DROP CONSTRAINT IF EXISTS "story_flags_player_id_npc_id_flag_name_pk";

ALTER TABLE "story_flags"
  ADD CONSTRAINT "story_flags_pk"
  PRIMARY KEY ("player_id", "world_id", "pack_version_id", "npc_id", "flag_name");

COMMENT ON COLUMN "story_flags"."world_id" IS 'Story Pack 世界 ID';
COMMENT ON COLUMN "story_flags"."pack_version_id" IS '版本目录名';
