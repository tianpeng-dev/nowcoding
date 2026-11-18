-- Harden Supabase Data API exposure for Cloud tables.
--
-- Cloud API routes use trusted server credentials for account, device, usage,
-- consent, and leaderboard data. Public profile, card, and leaderboard data
-- must be exposed through application routes, not direct Supabase table reads.

ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cli_auth_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.usage_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.usage_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.arena_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leaderboard_entries ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name text;
  table_revoke_targets text[] := ARRAY[
    'users',
    'devices',
    'cli_auth_flows',
    'usage_buckets',
    'usage_sessions',
    'arena_consents',
    'leaderboard_entries'
  ];
BEGIN
  FOREACH table_name IN ARRAY table_revoke_targets LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated',
        table_name
      );
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  sequence_name text;
  sequence_revoke_targets text[] := ARRAY[
    'usage_buckets_id_seq',
    'usage_sessions_id_seq',
    'leaderboard_entries_id_seq'
  ];
BEGIN
  FOREACH sequence_name IN ARRAY sequence_revoke_targets LOOP
    IF to_regclass(format('public.%I', sequence_name)) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL ON SEQUENCE public.%I FROM PUBLIC, anon, authenticated',
        sequence_name
      );
    END IF;
  END LOOP;
END $$;
