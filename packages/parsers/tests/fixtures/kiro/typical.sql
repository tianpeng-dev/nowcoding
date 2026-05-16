CREATE TABLE tokens_generated (
  id INTEGER PRIMARY KEY,
  model TEXT,
  tokens_prompt INTEGER,
  tokens_generated INTEGER,
  timestamp TEXT
);
INSERT INTO tokens_generated VALUES (1, 'agent', 11, 7, '2026-05-14 12:00:00');
