# NowCoding Cloud

[English](README.md) | [简体中文](README_zh.md)

## Launch guide

Private hosted service for NowCoding V2 Cloud and Arena. The public
`nowcoding` repo remains responsible for the open-source CLI, parsers, daemon,
self-host server, privacy trimming, and shared protocol types.

## Required environment

Set these variables in production:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Supabase Postgres transaction pooler connection string for Cloud account, device, usage, leaderboard, and moderation tables. |
| `DATABASE_MAX_CONNECTIONS` | Maximum Postgres connections per runtime instance. Use `1` for the Supabase transaction pooler. |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID. |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app secret. |
| `GITHUB_OAUTH_STATE_SECRET` | Secret used to sign and verify OAuth state. Rotate if state signing is exposed. |
| `NOWCODING_CLOUD_URL` | Public Cloud origin, for example `https://nowcoding.cc`. |
| `CRON_SECRET` | Bearer secret for scheduled leaderboard jobs. |
| `ADMIN_GITHUB_LOGINS` | Comma-separated GitHub logins allowed to use admin routes. |

Reserved for future session management: `SESSION_SECRET`. The current direct
GitHub OAuth flow signs OAuth state and temporary GitHub identity cookies with
`GITHUB_OAUTH_STATE_SECRET`, falling back to `GITHUB_CLIENT_SECRET`.

Reserved for future Supabase Auth integration: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. They
are listed in `.env.example` as commented placeholders and are not required by
the current deploy.

## Launch flow

1. Create a Supabase project with Postgres enabled. Auth and Edge Functions are
   reserved for later Cloud phases; the current auth flow exchanges GitHub OAuth
   directly through Next.js routes.
2. Set `DATABASE_URL` to the Supabase transaction pooler URL and set
   `DATABASE_MAX_CONNECTIONS=1`.
3. Create a GitHub OAuth app with callback
   `${NOWCODING_CLOUD_URL}/api/auth/github/callback`.
4. Create a Vercel project for the public `tianpeng-dev/nowcoding`
   repository and set all required environment variables from `.env.example`.
5. Configure Cron for the leaderboard job with `CRON_SECRET`.
6. Configure the Cloudflare `nowcoding.cc` zone to route `nowcoding.cc` to the
   Vercel production deployment with TLS enabled.
7. Apply the checked-in Cloud schema with `pnpm db:cloud:apply` before production
   traffic.
8. Verify RLS remains enabled before exposing production traffic.
9. Deploy the Next.js app in `apps/cloud`.
10. Run the verification commands:

   ```bash
   pnpm test
   pnpm typecheck
   pnpm lint
   NOWCODING_SMOKE_USERNAME=tianpeng-dev pnpm smoke:cloud https://nowcoding.cc
   ```

See [../../docs/cloud-deploy.md](../../docs/cloud-deploy.md) for the production deployment runbook.

For staging and production launch, use the
[production readiness checklist](../../docs/deployment-checklists/production-readiness.md).
The supported deploy path is:

```bash
pnpm db:cloud:apply
NOWCODING_SMOKE_USERNAME=tianpeng-dev pnpm smoke:cloud https://nowcoding.cc
```

Mutating smoke checks are opt-in only with
`NOWCODING_SMOKE_INCLUDE_MUTATING=1` or `--include-mutating`.

## Supabase access model

RLS must remain enabled on Cloud tables in the public schema. Cloud API routes
use trusted server credentials for database access; public profile, card, and
leaderboard data must be exposed through application routes, not direct
Supabase client table reads.

If `SUPABASE_SERVICE_ROLE_KEY` is enabled in a later Supabase Auth/Data API
phase, it is server-only. Do not expose it to browser bundles, the open-source
CLI, user config, logs, or any `NEXT_PUBLIC_` environment variable.

## Operational endpoints

CLI authentication:

- `POST /api/auth/cli/start` starts CLI login for `nowcoding login`, creates a
  short-lived poll token, and returns a GitHub OAuth verification URL containing
  a hidden one-time browser flow token.
- `GET /api/auth/github/start` opens GitHub OAuth.
- `GET /api/auth/github/callback` completes GitHub OAuth and marks the matching
  CLI flow as confirmed. It does not return or store the device token in the
  browser session.
- `POST /api/auth/cli/poll` uses the CLI-held poll token to mint and return a
  scoped NowCoding device token after OAuth confirmation.
- `POST /api/auth/cli/confirm` remains a manual fallback for older
  confirmation-code flows.

Ingest and heartbeat:

- `POST /api/cloud/usage/ingest` accepts aggregate usage buckets and sessions with a device token.
- `POST /api/cloud/usage/heartbeat` updates live status with a device token.

Hosted profile, card, badges, and stats:

- `GET /u/{username}` renders the official profile.
- `GET /u/{username}/card.svg` renders the README card.
- `GET /u/{username}/badge/{type}.svg` renders hosted badges.
- `GET /api/u/{username}/stats`, `/now`, and `/heatmap` expose public JSON.

Hosted cards expose V2 engagement fields: estimated AI-assisted time saved,
peak activity, milestone, top model, streak, and the 7-day token sparkline.

Arena leaderboard:

- `POST /api/jobs/leaderboard` rebuilds leaderboard snapshots and requires
  `Authorization: Bearer ${CRON_SECRET}`.
- `GET /leaderboard` renders the public Arena entry point.
- `GET /api/leaderboard?range=30d&scope=all&metric=tokens` returns leaderboard JSON.
  Supported metrics include `estimated_cost`, `tokens`, `active_time`,
  `streak`, and `time_saved`.

Admin:

- `GET /admin` exposes the minimal moderation UI for GitHub logins listed in
  `ADMIN_GITHUB_LOGINS`.
- `POST /api/admin/users/{id}/hide` hides a user.
- `POST /api/admin/leaderboard/{id}/exclude` excludes a leaderboard entry.
- `GET /api/admin/ingest/{userId}` shows a recent ingest summary.

## Consent and moderation

`nowcoding login` must ask for Cloud upload consent. "Join NowCoding Arena" can
be checked by default, but the confirmation view must show the public fields
before submission and allow the user to uncheck it. Arena data is self-reported
AI coding activity, so early moderation focuses on device tokens, rate limits,
payload limits, dedupe, capped public values, hiding users, and excluding
leaderboard entries.
