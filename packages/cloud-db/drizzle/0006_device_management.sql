ALTER TABLE IF EXISTS public.devices
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS hostname text,
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS cli_version text,
  ADD COLUMN IF NOT EXISTS client_info jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_ip_hash text,
  ADD COLUMN IF NOT EXISTS revoked_reason text;

UPDATE public.devices
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

ALTER TABLE IF EXISTS public.cli_auth_flows
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_nonce_hash text,
  ADD COLUMN IF NOT EXISTS status_expires_at timestamptz;

CREATE TABLE IF NOT EXISTS public.account_security_events (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES public.users(id),
  device_id uuid REFERENCES public.devices(id),
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_hash text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_security_events_user_id_idx
  ON public.account_security_events (user_id);

CREATE INDEX IF NOT EXISTS account_security_events_device_id_idx
  ON public.account_security_events (device_id);

ALTER TABLE IF EXISTS public.account_security_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.account_security_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.account_security_events_id_seq FROM PUBLIC, anon, authenticated;
