-- Align production schema with Supabase advisor recommendations.
--
-- Keep foreign key lookups predictable as data grows, and remove the duplicate
-- user_code_hash index created before the column-level unique constraint became
-- the canonical index.

DROP INDEX IF EXISTS public.cli_auth_flows_user_code_hash_idx;

CREATE INDEX IF NOT EXISTS devices_user_id_idx
  ON public.devices (user_id);

CREATE INDEX IF NOT EXISTS cli_auth_flows_user_id_idx
  ON public.cli_auth_flows (user_id);

CREATE INDEX IF NOT EXISTS cli_auth_flows_device_id_idx
  ON public.cli_auth_flows (device_id);

CREATE INDEX IF NOT EXISTS usage_buckets_device_id_idx
  ON public.usage_buckets (device_id);

CREATE INDEX IF NOT EXISTS usage_sessions_device_id_idx
  ON public.usage_sessions (device_id);

CREATE INDEX IF NOT EXISTS leaderboard_entries_user_id_idx
  ON public.leaderboard_entries (user_id);
