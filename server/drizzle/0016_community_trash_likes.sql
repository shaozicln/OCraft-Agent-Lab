-- 社区：Fork 多版本来源、回收站、点赞/收藏

ALTER TABLE "community_worlds"
  ADD COLUMN IF NOT EXISTS "forked_from_version_dirs" jsonb;

-- 旧单字段迁入数组（若存在）
DO $$ BEGIN
  UPDATE "community_worlds"
  SET "forked_from_version_dirs" = jsonb_build_array("forked_from_version_dir")
  WHERE "forked_from_version_dir" IS NOT NULL
    AND ("forked_from_version_dirs" IS NULL OR "forked_from_version_dirs" = 'null'::jsonb);
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "community_worlds_trash" (
  "world_id" text PRIMARY KEY NOT NULL,
  "short_name" text NOT NULL,
  "owner_player_id" text,
  "description" text,
  "official_version_dir" text NOT NULL,
  "is_official" text NOT NULL DEFAULT 'false',
  "is_shared" text NOT NULL DEFAULT 'false',
  "moderation" text NOT NULL DEFAULT 'normal',
  "forked_from_world_id" text,
  "forked_from_version_dirs" jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "deleted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_by" text NOT NULL,
  "delete_scope" text NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "community_worlds_trash"
    ADD CONSTRAINT "community_worlds_trash_owner_player_id_players_id_fk"
    FOREIGN KEY ("owner_player_id") REFERENCES "players"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "community_worlds_trash"
    ADD CONSTRAINT "community_worlds_trash_deleted_by_players_id_fk"
    FOREIGN KEY ("deleted_by") REFERENCES "players"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "community_versions_trash" (
  "world_id" text NOT NULL,
  "version_dir" text NOT NULL,
  "owner_player_id" text,
  "is_shared" text NOT NULL DEFAULT 'false',
  "moderation" text NOT NULL DEFAULT 'normal',
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "deleted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_by" text NOT NULL,
  "delete_scope" text NOT NULL,
  CONSTRAINT "community_versions_trash_pk" PRIMARY KEY ("world_id", "version_dir")
);

DO $$ BEGIN
  ALTER TABLE "community_versions_trash"
    ADD CONSTRAINT "community_versions_trash_owner_player_id_players_id_fk"
    FOREIGN KEY ("owner_player_id") REFERENCES "players"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "community_versions_trash"
    ADD CONSTRAINT "community_versions_trash_deleted_by_players_id_fk"
    FOREIGN KEY ("deleted_by") REFERENCES "players"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "pack_likes" (
  "player_id" text NOT NULL,
  "target_type" text NOT NULL,
  "world_id" text NOT NULL,
  "version_dir" text NOT NULL DEFAULT '',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "pack_likes_pk" PRIMARY KEY ("player_id", "target_type", "world_id", "version_dir")
);

DO $$ BEGIN
  ALTER TABLE "pack_likes"
    ADD CONSTRAINT "pack_likes_player_id_players_id_fk"
    FOREIGN KEY ("player_id") REFERENCES "players"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "pack_favorites" (
  "player_id" text NOT NULL,
  "target_type" text NOT NULL,
  "world_id" text NOT NULL,
  "version_dir" text NOT NULL DEFAULT '',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "pack_favorites_pk" PRIMARY KEY ("player_id", "target_type", "world_id", "version_dir")
);

DO $$ BEGIN
  ALTER TABLE "pack_favorites"
    ADD CONSTRAINT "pack_favorites_player_id_players_id_fk"
    FOREIGN KEY ("player_id") REFERENCES "players"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE "community_worlds_trash" IS '世界回收站：进站/恢复为行转移';
COMMENT ON TABLE "pack_likes" IS '世界或版本点赞；version 级 version_dir 非空，world 级为空串';
