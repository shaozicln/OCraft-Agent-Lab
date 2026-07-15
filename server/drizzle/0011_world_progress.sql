-- L2 共享世界进度（与 default_npc 解耦）
CREATE TABLE IF NOT EXISTS "world_progress" (
  "player_id" text NOT NULL REFERENCES "players"("id"),
  "world_id" text NOT NULL,
  "pack_version_id" text NOT NULL,
  "chapter_state" text NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "world_progress_pk" PRIMARY KEY ("player_id", "world_id", "pack_version_id")
);

CREATE TABLE IF NOT EXISTS "world_flags" (
  "player_id" text NOT NULL REFERENCES "players"("id"),
  "world_id" text NOT NULL,
  "pack_version_id" text NOT NULL,
  "flag_name" text NOT NULL,
  "value" text NOT NULL DEFAULT 'true',
  CONSTRAINT "world_flags_pk" PRIMARY KEY ("player_id", "world_id", "pack_version_id", "flag_name")
);

COMMENT ON TABLE "world_progress" IS '共享世界章节（L2）；不按 npc 分';
COMMENT ON TABLE "world_flags" IS '共享世界 flags（L2）；升章/互聊条件读这里';

-- 从 default_npc（或任意有章的行）回填世界进度
INSERT INTO "world_progress" ("player_id", "world_id", "pack_version_id", "chapter_state", "updated_at")
SELECT DISTINCT ON (pns."player_id", pns."world_id", pns."pack_version_id")
  pns."player_id",
  pns."world_id",
  pns."pack_version_id",
  pns."chapter_state",
  now()
FROM "player_npc_state" pns
ORDER BY pns."player_id", pns."world_id", pns."pack_version_id", pns."npc_id"
ON CONFLICT DO NOTHING;

-- 回填：把各 npc 的 story_flags 并入世界（同名保留已有）
INSERT INTO "world_flags" ("player_id", "world_id", "pack_version_id", "flag_name", "value")
SELECT DISTINCT ON (sf."player_id", sf."world_id", sf."pack_version_id", sf."flag_name")
  sf."player_id",
  sf."world_id",
  sf."pack_version_id",
  sf."flag_name",
  sf."value"
FROM "story_flags" sf
ORDER BY sf."player_id", sf."world_id", sf."pack_version_id", sf."flag_name", sf."npc_id"
ON CONFLICT DO NOTHING;
