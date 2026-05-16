# Migrating from vibe-usage

NowCoding's CLI is API-compatible with `vibe-usage`'s ingest protocol. If
you already run vibe-usage, the migration is a token swap and a re-init.

## Steps

1. **Deploy your NowCoding instance** (see [deploy.md](deploy.md)).
2. **Stop the vibe-usage daemon / cron** if you had one running.
3. **Re-init the CLI** against your NowCoding endpoint:
   ```bash
   npx nowcoding init \
     --endpoint https://<your-name>.vercel.app \
     --token nc_live_<your token>
   ```
   This rewrites `~/.nowcoding/config.json` (mode 0600). The old
   `~/.vibe-usage/` directory is left alone — feel free to delete it once
   you've verified the new flow.
4. **First sync runs full**: NowCoding's local cache is empty, so the first
   `nowcoding sync` will re-scan all your AI tool logs from scratch. Subsequent
   runs use per-file mtime + size for incremental updates.
5. **Schema differences from vibe-usage**:
   - `cost_usd` is present as server-calculated estimated cost. The CLI does
     not upload cost amounts; the server writes `cost_usd` and
     `price_version`.
   - `hostname` is **NOT NULL** with default `'unknown'` (P0-4 fix).
   - `heartbeats` stores lightweight live status activity summaries.
   - `session_hash` is the first 16 hex chars of `sha256(originalSessionId)` —
     original IDs are never transmitted.

## Backfilling history

NowCoding's ingest endpoint accepts arbitrary `bucket_start` values, so you
can replay older logs at any time. After the initial sync, check the
`/` profile or `/api/stats?period=all` to confirm coverage.

## Caveats

- Cursor: vibe-usage may have scraped Cursor's private dashboard CSV. NowCoding
  v1.0 disables the Cursor parser by default and requires the user to opt in
  twice (P1-2). If you depended on Cursor data, expect that source to be empty
  until W4.5+ when the SQLite-based parser ships.
- Generic parsers in `packages/parsers/src/registry.ts` use best-effort
  default paths derived from each tool's documented home directory layout.
  If your install uses a custom path, send a PR or open an issue.
