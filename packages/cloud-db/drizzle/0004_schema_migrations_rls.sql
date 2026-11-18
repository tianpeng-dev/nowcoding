-- Harden the local migration history table in Supabase public schema.
--
-- The table only stores filenames and checksums, but it still lives in the
-- exposed public schema. Keep the same direct-access posture as Cloud data
-- tables: server-side code can use the database connection, while anon and
-- authenticated Data API roles get no direct table access.

ALTER TABLE IF EXISTS public.nowcoding_schema_migrations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.nowcoding_schema_migrations
  FROM PUBLIC, anon, authenticated;
