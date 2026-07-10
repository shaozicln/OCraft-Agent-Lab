-- P0：包版本 seed 表 + 玩家选用包字段

ALTER TABLE "players"
  ADD COLUMN IF NOT EXISTS "selected_world_id" text,
  ADD COLUMN IF NOT EXISTS "selected_pack_version_id" text;

COMMENT ON COLUMN "players"."selected_world_id" IS '选用世界；null=跟随全服默认默认';
COMMENT ON COLUMN "players"."selected_pack_version_id" IS '选用版本目录名；null=跟随全服默认默认';

CREATE TABLE IF NOT EXISTS "story_pack_versions" (
  "world_id" text NOT NULL,
  "pack_version_id" text NOT NULL,
  "display_name" text NOT NULL,
  "created_at" text NOT NULL,
  "notes" text,
  "pack_json" jsonb NOT NULL,
  "seeded_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "story_pack_versions_pk" PRIMARY KEY ("world_id", "pack_version_id")
);

COMMENT ON TABLE "story_pack_versions" IS 'seed 进库的 Story Pack 版本全文';
COMMENT ON COLUMN "story_pack_versions"."pack_version_id" IS 'versions/ 下目录名';
COMMENT ON COLUMN "story_pack_versions"."pack_json" IS '完整 StoryPack JSON';
