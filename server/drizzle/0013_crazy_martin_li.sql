CREATE TABLE "conversation_archives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" text NOT NULL,
	"npc_id" text NOT NULL,
	"world_id" text,
	"pack_version_id" text,
	"scope" text DEFAULT 'npc' NOT NULL,
	"filename" text NOT NULL,
	"display_name" text,
	"session_started_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"archive_id" uuid NOT NULL,
	"snapshot_index" integer NOT NULL,
	"saved_at" timestamp with time zone NOT NULL,
	"npc_state" jsonb NOT NULL,
	"messages" jsonb NOT NULL,
	"payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "player_npc_state" (
	"player_id" text NOT NULL,
	"world_id" text NOT NULL,
	"pack_version_id" text NOT NULL,
	"npc_id" text NOT NULL,
	"affinity" integer NOT NULL,
	"fatigue" integer NOT NULL,
	"current_status" text NOT NULL,
	"chapter_state" text NOT NULL,
	"recent_messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"transcript_messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"session_started_at" timestamp with time zone,
	"active_archive_filename" text,
	CONSTRAINT "player_npc_state_pk" PRIMARY KEY("player_id","world_id","pack_version_id","npc_id")
);
--> statement-breakpoint
CREATE TABLE "player_pack_profiles" (
	"player_id" text NOT NULL,
	"world_id" text NOT NULL,
	"pack_version_id" text NOT NULL,
	"real_name" text,
	"online_name" text,
	"job_title" text,
	"gender" text,
	"age" integer,
	"birthday" date,
	"extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_pack_profiles_pk" PRIMARY KEY("player_id","world_id","pack_version_id")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text,
	"password_hash" text,
	"selected_world_id" text,
	"selected_pack_version_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_flags" (
	"player_id" text NOT NULL,
	"world_id" text NOT NULL,
	"pack_version_id" text NOT NULL,
	"npc_id" text NOT NULL,
	"flag_name" text NOT NULL,
	"value" text DEFAULT 'true' NOT NULL,
	CONSTRAINT "story_flags_pk" PRIMARY KEY("player_id","world_id","pack_version_id","npc_id","flag_name")
);
--> statement-breakpoint
CREATE TABLE "story_pack_versions" (
	"world_id" text NOT NULL,
	"pack_version_id" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" text NOT NULL,
	"notes" text,
	"pack_json" jsonb NOT NULL,
	"seeded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_pack_versions_pk" PRIMARY KEY("world_id","pack_version_id")
);
--> statement-breakpoint
CREATE TABLE "world_flags" (
	"player_id" text NOT NULL,
	"world_id" text NOT NULL,
	"pack_version_id" text NOT NULL,
	"flag_name" text NOT NULL,
	"value" text DEFAULT 'true' NOT NULL,
	CONSTRAINT "world_flags_pk" PRIMARY KEY("player_id","world_id","pack_version_id","flag_name")
);
--> statement-breakpoint
CREATE TABLE "world_progress" (
	"player_id" text NOT NULL,
	"world_id" text NOT NULL,
	"pack_version_id" text NOT NULL,
	"chapter_state" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "world_progress_pk" PRIMARY KEY("player_id","world_id","pack_version_id")
);
--> statement-breakpoint
ALTER TABLE "conversation_archives" ADD CONSTRAINT "conversation_archives_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_snapshots" ADD CONSTRAINT "conversation_snapshots_archive_id_conversation_archives_id_fk" FOREIGN KEY ("archive_id") REFERENCES "public"."conversation_archives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_npc_state" ADD CONSTRAINT "player_npc_state_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_pack_profiles" ADD CONSTRAINT "player_pack_profiles_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_flags" ADD CONSTRAINT "story_flags_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_flags" ADD CONSTRAINT "world_flags_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_progress" ADD CONSTRAINT "world_progress_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "archives_player_filename_idx" ON "conversation_archives" USING btree ("player_id","filename");--> statement-breakpoint
CREATE UNIQUE INDEX "snapshots_archive_index_idx" ON "conversation_snapshots" USING btree ("archive_id","snapshot_index");--> statement-breakpoint
CREATE UNIQUE INDEX "players_username_idx" ON "players" USING btree ("username");