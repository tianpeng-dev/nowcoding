CREATE TABLE "buckets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"model" text NOT NULL,
	"project" text DEFAULT 'unknown' NOT NULL,
	"hostname" text DEFAULT 'unknown' NOT NULL,
	"bucket_start" timestamp with time zone NOT NULL,
	"input_tokens" bigint DEFAULT 0 NOT NULL,
	"output_tokens" bigint DEFAULT 0 NOT NULL,
	"cached_input_tokens" bigint DEFAULT 0 NOT NULL,
	"reasoning_output_tokens" bigint DEFAULT 0 NOT NULL,
	"total_tokens" bigint DEFAULT 0 NOT NULL,
	"request_count" bigint DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"price_version" text DEFAULT '2026-05-13-v1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heartbeats" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"model" text,
	"project" text DEFAULT 'unknown' NOT NULL,
	"hostname" text DEFAULT 'unknown' NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owner" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"display_name" text,
	"bio" text,
	"github_handle" text,
	"avatar_url" text,
	"website_url" text,
	"location" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"project" text DEFAULT 'unknown' NOT NULL,
	"session_hash" text NOT NULL,
	"first_message_at" timestamp with time zone NOT NULL,
	"last_message_at" timestamp with time zone NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"active_seconds" integer DEFAULT 0 NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"user_message_count" integer DEFAULT 0 NOT NULL,
	"user_prompt_hours" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hostname" text DEFAULT 'unknown' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"source" text NOT NULL,
	"hostname" text NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_file_mtime" timestamp with time zone,
	"total_buckets" bigint DEFAULT 0 NOT NULL,
	"total_sessions" bigint DEFAULT 0 NOT NULL,
	"total_errors" integer DEFAULT 0 NOT NULL,
	"last_error_message" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_state_source_hostname_pk" PRIMARY KEY("source","hostname")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "buckets_uniq_idx" ON "buckets" USING btree ("source","model","project","bucket_start","hostname");--> statement-breakpoint
CREATE INDEX "buckets_time_idx" ON "buckets" USING btree ("bucket_start");--> statement-breakpoint
CREATE INDEX "buckets_source_idx" ON "buckets" USING btree ("source");--> statement-breakpoint
CREATE INDEX "buckets_model_idx" ON "buckets" USING btree ("model");--> statement-breakpoint
CREATE INDEX "heartbeats_source_idx" ON "heartbeats" USING btree ("source");--> statement-breakpoint
CREATE INDEX "heartbeats_last_seen_idx" ON "heartbeats" USING btree ("last_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_uniq_idx" ON "sessions" USING btree ("session_hash","source","hostname");--> statement-breakpoint
CREATE INDEX "sessions_time_idx" ON "sessions" USING btree ("first_message_at");--> statement-breakpoint
CREATE INDEX "sessions_last_message_idx" ON "sessions" USING btree ("last_message_at");
