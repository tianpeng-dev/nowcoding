-- Fresh Supabase bootstrap schema for NowCoding Cloud.
--
-- Later migrations in this directory are incremental. A new private Cloud
-- database must apply this baseline first so the incremental migrations can run
-- against the expected tables, indexes, and sequences.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE,
  github_id text UNIQUE,
  github_login text UNIQUE,
  display_name text,
  avatar_url text,
  timezone text DEFAULT 'UTC',
  hidden_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id),
  name text,
  token_hash text UNIQUE,
  last_seen_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cli_auth_flows (
  poll_token_hash text PRIMARY KEY,
  device_name text,
  join_arena boolean DEFAULT true,
  user_code_hash text UNIQUE,
  user_id uuid REFERENCES public.users(id),
  device_id uuid REFERENCES public.devices(id),
  device_token text,
  expires_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.usage_buckets (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id),
  device_id uuid NOT NULL REFERENCES public.devices(id),
  source text NOT NULL,
  model text NOT NULL,
  project text NOT NULL DEFAULT 'unknown',
  hostname text NOT NULL DEFAULT 'unknown',
  bucket_start timestamp with time zone NOT NULL,
  prompt_tokens bigint DEFAULT 0,
  completion_tokens bigint DEFAULT 0,
  total_tokens bigint DEFAULT 0,
  request_count bigint DEFAULT 0,
  cost_usd numeric(12, 6) DEFAULT 0,
  excluded_from_arena_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS usage_buckets_unique_idx
  ON public.usage_buckets (
    user_id,
    device_id,
    source,
    model,
    project,
    bucket_start,
    hostname
  );

CREATE INDEX IF NOT EXISTS usage_buckets_user_bucket_start_idx
  ON public.usage_buckets (user_id, bucket_start);

CREATE TABLE IF NOT EXISTS public.usage_sessions (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id),
  device_id uuid NOT NULL REFERENCES public.devices(id),
  source text NOT NULL,
  project text NOT NULL DEFAULT 'unknown',
  session_hash text NOT NULL,
  first_message_at timestamp with time zone NOT NULL,
  last_message_at timestamp with time zone NOT NULL,
  duration_seconds bigint NOT NULL,
  active_seconds bigint NOT NULL,
  message_count bigint NOT NULL,
  user_message_count bigint NOT NULL,
  user_prompt_hours jsonb NOT NULL DEFAULT '[]'::jsonb,
  hostname text NOT NULL DEFAULT 'unknown',
  created_at timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS usage_sessions_unique_idx
  ON public.usage_sessions (user_id, device_id, session_hash, source, hostname);

CREATE INDEX IF NOT EXISTS usage_sessions_user_last_message_at_idx
  ON public.usage_sessions (user_id, last_message_at);

CREATE TABLE IF NOT EXISTS public.arena_consents (
  user_id uuid PRIMARY KEY REFERENCES public.users(id),
  joined boolean DEFAULT false,
  public_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  accepted_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leaderboard_entries (
  id bigserial PRIMARY KEY,
  range text NOT NULL,
  scope text NOT NULL,
  metric text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(id),
  score numeric(20, 6),
  public_value text,
  rank integer,
  excluded_at timestamp with time zone,
  generated_at timestamp with time zone NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS leaderboard_entries_unique_idx
  ON public.leaderboard_entries (
    range,
    scope,
    metric,
    user_id,
    generated_at
  );
