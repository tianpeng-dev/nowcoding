CREATE TABLE sessions (
  id TEXT,
  model TEXT,
  started_at REAL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cache_read_tokens INTEGER,
  reasoning_tokens INTEGER
);
