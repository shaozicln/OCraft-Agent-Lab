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

CREATE TABLE IF NOT EXISTS "story_flags" (
  "player_id" uuid NOT NULL REFERENCES "players"("id"),
  "npc_id" text NOT NULL,
  "flag_name" text NOT NULL,
  "value" boolean DEFAULT true NOT NULL,
  CONSTRAINT "story_flags_player_id_npc_id_flag_name_pk" PRIMARY KEY("player_id","npc_id","flag_name")
);

CREATE TABLE IF NOT EXISTS "conversation_archives" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" uuid NOT NULL REFERENCES "players"("id"),
  "npc_id" text NOT NULL,
  "filename" text NOT NULL,
  "session_started_at" timestamp with time zone NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "archives_player_filename_idx" ON "conversation_archives" ("player_id","filename");

CREATE TABLE IF NOT EXISTS "conversation_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "archive_id" uuid NOT NULL REFERENCES "conversation_archives"("id") ON DELETE cascade,
  "snapshot_index" integer NOT NULL,
  "saved_at" timestamp with time zone NOT NULL,
  "npc_state" jsonb NOT NULL,
  "messages" jsonb NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "snapshots_archive_index_idx" ON "conversation_snapshots" ("archive_id","snapshot_index");
