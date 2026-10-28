-- 社区剧情包：归属 / 共享 / 官方 / 审核隐藏
-- 磁盘仍为内容源；本表管可见性与权限

ALTER TABLE "players"
  ADD COLUMN IF NOT EXISTS "is_admin" text NOT NULL DEFAULT 'false';

COMMENT ON COLUMN "players"."is_admin" IS 'true=站点管理员（审核/官方标记）；false=普通用户';

CREATE TABLE IF NOT EXISTS "community_worlds" (
  "world_id" text PRIMARY KEY NOT NULL,
  "short_name" text NOT NULL,
  "owner_player_id" text,
  "description" text,
  "official_version_dir" text NOT NULL,
  "is_official" text NOT NULL DEFAULT 'false',
  "is_shared" text NOT NULL DEFAULT 'false',
  "moderation" text NOT NULL DEFAULT 'normal',
  "forked_from_world_id" text,
  "forked_from_version_dir" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "community_worlds"
    ADD CONSTRAINT "community_worlds_owner_player_id_players_id_fk"
    FOREIGN KEY ("owner_player_id") REFERENCES "players"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "community_versions" (
  "world_id" text NOT NULL,
  "version_dir" text NOT NULL,
  "owner_player_id" text,
  "is_shared" text NOT NULL DEFAULT 'false',
  "moderation" text NOT NULL DEFAULT 'normal',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "community_versions_pk" PRIMARY KEY ("world_id", "version_dir")
);

DO $$ BEGIN
  ALTER TABLE "community_versions"
    ADD CONSTRAINT "community_versions_world_id_community_worlds_world_id_fk"
    FOREIGN KEY ("world_id") REFERENCES "community_worlds"("world_id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "community_versions"
    ADD CONSTRAINT "community_versions_owner_player_id_players_id_fk"
    FOREIGN KEY ("owner_player_id") REFERENCES "players"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE "community_worlds" IS '社区世界元数据；world_id 全局唯一（用户包 u{uid}_{shortName}）';
COMMENT ON TABLE "community_versions" IS '社区版本元数据；共享需世界先共享且至少一版共享';
