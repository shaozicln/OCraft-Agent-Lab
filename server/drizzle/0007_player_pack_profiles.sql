-- 角色人设按 Pack 版本隔离；账号表只保留登录字段

CREATE TABLE IF NOT EXISTS "player_pack_profiles" (
  "player_id" text NOT NULL REFERENCES "players"("id"),
  "world_id" text NOT NULL,
  "pack_version_id" text NOT NULL,
  "real_name" text,
  "online_name" text,
  "job_title" text,
  "gender" text,
  "age" integer,
  "birthday" date,
  "extra" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "player_pack_profiles_pk" PRIMARY KEY ("player_id", "world_id", "pack_version_id")
);

-- 把旧 players 上的人设迁到「当前选用包」（无选用则 office 默认版）
INSERT INTO "player_pack_profiles" (
  "player_id",
  "world_id",
  "pack_version_id",
  "real_name",
  "online_name",
  "job_title",
  "gender",
  "age",
  "birthday",
  "extra",
  "updated_at"
)
SELECT
  p."id",
  COALESCE(p."selected_world_id", 'office'),
  COALESCE(
    p."selected_pack_version_id",
    (
      SELECT sp."pack_version_id"
      FROM "story_pack_versions" sp
      WHERE sp."world_id" = COALESCE(p."selected_world_id", 'office')
      ORDER BY sp."seeded_at" DESC
      LIMIT 1
    ),
    'official-mvp__20260710T1045'
  ),
  p."real_name",
  p."online_name",
  p."job_title",
  p."gender",
  p."age",
  p."birthday",
  COALESCE(p."extra", '{}'::jsonb),
  p."updated_at"
FROM "players" p
WHERE
  p."real_name" IS NOT NULL
  OR p."online_name" IS NOT NULL
  OR p."job_title" IS NOT NULL
  OR p."gender" IS NOT NULL
  OR p."age" IS NOT NULL
  OR p."birthday" IS NOT NULL
  OR (p."extra" IS NOT NULL AND p."extra"::text <> '{}')
ON CONFLICT DO NOTHING;

ALTER TABLE "players" DROP COLUMN IF EXISTS "real_name";
ALTER TABLE "players" DROP COLUMN IF EXISTS "online_name";
ALTER TABLE "players" DROP COLUMN IF EXISTS "job_title";
ALTER TABLE "players" DROP COLUMN IF EXISTS "gender";
ALTER TABLE "players" DROP COLUMN IF EXISTS "age";
ALTER TABLE "players" DROP COLUMN IF EXISTS "birthday";
ALTER TABLE "players" DROP COLUMN IF EXISTS "extra";

COMMENT ON TABLE "player_pack_profiles" IS '玩家在某 world/pack_version 下的角色人设';
