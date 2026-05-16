# Changelog

## [Unreleased] — v1.0.0-alpha

The original internal alpha roadmap shipped as a single milestone covering W1
through W8.

### Added
- Monorepo skeleton: pnpm workspaces, Turborepo, Biome, Vitest, TypeScript 5.7, strict tsconfig.
- 5-table Drizzle schema (`owner`, `buckets`, `sessions`, `sync_state`, `events`) with composite primary key on `sync_state` (P0-5) and `NOT NULL DEFAULT 'unknown'` on `hostname`/`project` so the unique index actually deduplicates (P0-4).
- `@nowcoding/core`: 30-minute bucket aggregation, sha256(sessionId) extractor, streak computation, Zod ingest schemas, fail-closed privacy AND.
- `@nowcoding/parsers`: `BaseParser`, `JsonlParser`, `CommonJsonlParser`, plus 18 registered parsers (Claude Code full, Cursor opt-in only, 16 stubs sharing the common usage shape).
- `@nowcoding/db`: standard Postgres client, `getPeriodStats`, `getStreak`.
- `apps/web` (Next.js 16 App Router):
  - `/` profile page with Recharts sparkline + model pie + tool bars and 60s ISR.
  - `/setup` post-deploy wizard.
  - `/badge/{today,week,total,model,streak}.svg` — real SVG (no PNG raster), 5-min CDN cache, theme support.
  - `/card` — 495×195 README card.
  - `/og/[type]` — OG image (PNG, 1-hr CDN cache).
  - `/api/usage/ingest` POST/DELETE — Bearer-authed, gzip-aware, Zod-validated, upsert with `onConflictDoUpdate`, timing-safe token compare (P0-6).
  - `/api/usage/settings` GET — env-driven privacy fail-closed.
  - `/api/stats?period=…` — aggregated JSON.
  - `/api/cron/aggregate` — daily UTC 00:00, refreshes owner profile + computes streak, `CRON_SECRET` auth.
- `apps/cli` (`nowcoding` on npm): zero external runtime deps, bundled with tsup to ~138 KB.
  - `init` (writes `~/.nowcoding/config.json` mode 0600)
  - `sync` (parser fan-out, AND privacy, gzip + Bearer ingest, per-file mtime cache — P1-1)
  - `doctor` and `status`
- Drizzle migration generated at `packages/db/drizzle/0000_overconfident_randall.sql`.
- `scripts/gen-token.mjs` for cryptographically random API tokens.
- Documentation: README, SECURITY.md, NOTICE, LICENSE, plus `docs/`:
  - `README_zh.md` — simplified Chinese public README.
  - `local-dev.md` — first MVP verification recipe.
  - `deploy.md` — Deploy with Vercel + manual flow.
  - `env.md` — env variable reference.
  - `migration.md` — moving from vibe-usage.
  - `parsers.md` — list + how to add one.
  - `v1.5-backlog.md` — explicitly deferred items.
- GitHub Actions CI (lint → typecheck → test → build).
- vercel.json with regions (`sfo1`/`iad1`/`fra1`) + cron entry.
- 35 unit tests + 1 real-SQL integration test (pglite proves P0-4 dedup).

### Intentionally NOT in v1.0
- `cost_usd` field anywhere (PRD §13.7).
- GitHub OAuth / multi-user (`/u/[username]` routing).
- Heatmap, Live "coding now" badge, Wrapped.
- Email / webhook / push notifications.
- iframe/JS embed widget.
- Cursor real parser (opt-in only; SQLite-based parser ships in v1.0.x).
- Cloudflare deploy template, Docker, macOS menu bar app.

See [docs/v1.5-backlog.md](docs/v1.5-backlog.md) for the full deferred list.

### Verification
```
pnpm lint        # clean
pnpm typecheck   # 10/10 packages
pnpm test        # 35 passed (7 files)
pnpm build       # 6/6 packages
```
