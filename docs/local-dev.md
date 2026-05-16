# Local development & first MVP verification

This guide walks through running NowCoding locally end-to-end with your own
Claude Code data. It assumes you already cloned the repo and have Node 20+ and
pnpm 9 (via `corepack enable`).

## 1. Install & verify the toolchain

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build      # uses placeholder DATABASE_URL — won't connect
```

If any step fails, fix that before continuing.

## 2. Create Postgres for local dev

Use Supabase Postgres for Cloud-like local runtime testing, or any standard
Postgres database you can reach from the app.

1. Visit https://supabase.com, sign up, create a project.
2. Copy the transaction pooler connection string from Project Settings > Database.
3. Save it to `apps/web/.env.local`:
   ```bash
   cd apps/web
   cp ../../.env.example .env.local
   # edit .env.local, paste DATABASE_URL=postgresql://...
   ```

## 3. Push the schema

Drizzle has already generated the baseline migration SQL in `packages/db/drizzle/`.

```bash
cd packages/db
DATABASE_URL='<your-url>' pnpm push     # drizzle-kit push
```

You should see 5 tables created (`owner`, `buckets`, `sessions`, `sync_state`,
`heartbeats`). `events` is reserved for v1.5 achievement/notification work.

## 4. Set the rest of the env vars

In `apps/web/.env.local`:

```env
DATABASE_URL=postgres://...
NOWCODING_USERNAME=alice
NOWCODING_GITHUB_HANDLE=alice
NOWCODING_API_TOKEN=
NOWCODING_UPLOAD_PROJECT=false
NOWCODING_UPLOAD_HOSTNAME=true
NOWCODING_TIMEZONE=UTC
NOWCODING_SHOW_COST=true
NOWCODING_SHOW_LIVE=true
```

Generate a real token:

```bash
npx nowcoding gen-token
```

## 5. Start the web app

```bash
pnpm --filter @nowcoding/web dev
```

Visit:
- http://localhost:3000/                 — Profile page (will say "no data yet")
- http://localhost:3000/badge/today.svg  — Empty badge (`—` placeholder)
- http://localhost:3000/badge/streak.svg — Streak badge (0 days before data)
- http://localhost:3000/badge/live.svg   — Live status badge
- http://localhost:3000/card.svg         — README card SVG
- http://localhost:3000/api/now          — Live status JSON
- http://localhost:3000/api/heatmap      — Annual heatmap JSON
- http://localhost:3000/setup            — Post-deploy wizard
- http://localhost:3000/api/usage/settings — Privacy settings JSON with a Bearer token

Open `/setup` before syncing and confirm Database, API token, Endpoint, and
Profile show the expected readiness state for your local env.

## 6. Sync your Claude Code data via the CLI

In a second terminal:

```bash
cd apps/cli
pnpm build
node bin/nowcoding.js init \
  --endpoint http://localhost:3000
node bin/nowcoding.js sync
node bin/nowcoding.js heartbeat
```

Paste the same `NOWCODING_API_TOKEN` from `apps/web/.env.local` when `init`
prompts for it.

You should see something like:

```
[privacy] local={"uploadProject":false,...} server={...} effective={...}
[claude-code] 1234 records parsed
Aggregated: 87 buckets, 12 sessions
✓ Stored: buckets=87/87 sessions=12/12
```

## 7. Verify

Refresh the profile page — you should now see a 7-day token total, top model,
estimated cost labeled as estimated, current streak, and the badge SVGs render
real numbers. Verify `/api/now` returns live/recent/idle state, `/api/heatmap`
returns owner-timezone daily cells, `/badge/streak.svg` renders the streak, and
cost disappears from public responses when `NOWCODING_SHOW_COST=false`. Run
`sync` again — buckets count **should not increase** (P0-4 dedup at work).

When the release smoke script is present, run the public route checks against
the local app:

```bash
NOWCODING_SMOKE_BASE_URL='http://localhost:3000' NOWCODING_SMOKE_PUBLIC_ONLY=true pnpm smoke
```

For a deployed instance, point the same check at production. Add
`NOWCODING_SMOKE_TOKEN` when you also want to verify the authenticated settings
endpoint:

```bash
NOWCODING_SMOKE_BASE_URL='https://your-deployment.vercel.app' NOWCODING_SMOKE_PUBLIC_ONLY=true pnpm smoke
read -rs NOWCODING_SMOKE_TOKEN
export NOWCODING_SMOKE_TOKEN
NOWCODING_SMOKE_BASE_URL='https://your-deployment.vercel.app' pnpm smoke
unset NOWCODING_SMOKE_TOKEN
```

## P0/P1 guards verified locally

| Guard | Where | How to verify |
|---|---|---|
| P0-3 privacy AND | `packages/core/src/privacy.ts` | `pnpm test` (8 cases) |
| P0-4 dedup | `packages/db/src/schema/buckets.ts` | `pnpm test` (pglite SQL proof) |
| P0-5 composite PK | `packages/db/src/schema/sync_state.ts` | `drizzle-kit generate` SQL inspection |
| P0-6 timing-safe Bearer | `apps/web/lib/auth.ts` | `curl -X POST` with bad token returns 401 |
| P1-1 incremental sync | `packages/parsers/src/claude-code.ts` | `pnpm test` (mtime+size cache test) |

## Deferred after v1.0

- Parser coverage remains uneven: `claude-code` is complete, 16 sources use
  generic adapters, and Cursor remains opt-in only.
- Account-level hosting, team instances, and in-app environment editing are not
  part of the single-tenant v1.0 release.

See [docs/v1.5-backlog.md](v1.5-backlog.md) for non-core items intentionally deferred.
