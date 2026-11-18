CREATE TABLE IF NOT EXISTS usage_sessions (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  device_id uuid NOT NULL REFERENCES devices(id),
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
  ON usage_sessions (user_id, device_id, session_hash, source, hostname);

CREATE INDEX IF NOT EXISTS usage_sessions_user_last_message_at_idx
  ON usage_sessions (user_id, last_message_at);
