ALTER TABLE cli_auth_flows
  ADD COLUMN IF NOT EXISTS device_token text;

ALTER TABLE cli_auth_flows
  ADD COLUMN IF NOT EXISTS user_code_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS cli_auth_flows_user_code_hash_idx
  ON cli_auth_flows (user_code_hash);
