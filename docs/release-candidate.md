# NowCoding v1 Release Candidate Rehearsal

This runbook proves a commit is ready to become a v1 release candidate. It does not publish to npm and does not create a public GitHub Release.

## Required Operator Values

Set these in the shell running the rehearsal:

```bash
export NOWCODING_RC_BASE_URL="https://rc.example.invalid"
read -rs NOWCODING_SMOKE_TOKEN
export NOWCODING_SMOKE_TOKEN
read -rs NOWCODING_DEPLOY_DATABASE_URL
export NOWCODING_DEPLOY_DATABASE_URL
read -rs NOWCODING_RC_CRON_SECRET
export NOWCODING_RC_CRON_SECRET
```

Use the real Vercel preview URL for `NOWCODING_RC_BASE_URL`. The `.invalid` value above is a sentinel that must be replaced in the local shell before any network command will pass.

## Local CI Gate

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @nowcoding/web build
node --check scripts/smoke.mjs
node --check scripts/seed-smoke-data.mjs
node --check scripts/check-cli-pack.mjs
```

## Local Production Gate

Start a production server from a clean build:

```bash
rm -rf apps/web/.next
NOWCODING_USERNAME=localtest \
NOWCODING_API_TOKEN="$NOWCODING_SMOKE_TOKEN" \
CRON_SECRET="$NOWCODING_RC_CRON_SECRET" \
NOWCODING_TIMEZONE=Asia/Shanghai \
pnpm --filter @nowcoding/web build

NOWCODING_USERNAME=localtest \
NOWCODING_API_TOKEN="$NOWCODING_SMOKE_TOKEN" \
CRON_SECRET="$NOWCODING_RC_CRON_SECRET" \
NOWCODING_TIMEZONE=Asia/Shanghai \
pnpm --filter @nowcoding/web start --hostname 127.0.0.1 --port 3100
```

In another shell:

```bash
curl -fsS http://127.0.0.1:3100/setup >/dev/null
curl -fsS http://127.0.0.1:3100/ >/dev/null
curl -fsS http://127.0.0.1:3100/card.svg >/dev/null
curl -fsS http://127.0.0.1:3100/badge/today.svg >/dev/null
curl -fsS http://127.0.0.1:3100/og/profile.png >/dev/null
test "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3100/api/usage/settings)" = "401"
```

Without `DATABASE_URL`, full `pnpm smoke` is expected to fail because `/api/stats`, `/api/now`, and `/api/heatmap` return `DATABASE_NOT_CONFIGURED`. This is only a local limitation. Profile, setup, card, badge, OG, and auth rejection checks must still be reachable.

## Vercel And Postgres Gate

Configure the Vercel project with:

- `DATABASE_URL`
- `NOWCODING_USERNAME`
- `NOWCODING_API_TOKEN`
- `CRON_SECRET`
- `NOWCODING_TIMEZONE`
- optional profile and privacy env vars

Push the schema from the local shell:

```bash
DATABASE_URL="$NOWCODING_DEPLOY_DATABASE_URL" pnpm db:push
```

Visit:

```text
$NOWCODING_RC_BASE_URL/setup
```

The setup page must show database, token, endpoint, and profile as ready.

## Data Gate

Seed controlled rehearsal data:

```bash
NOWCODING_SMOKE_BASE_URL="$NOWCODING_RC_BASE_URL" pnpm smoke:seed
```

Run the local CLI against the same deployment:

```bash
pnpm --filter nowcoding build
node apps/cli/bin/nowcoding.js init --endpoint "$NOWCODING_RC_BASE_URL"
node apps/cli/bin/nowcoding.js sync
node apps/cli/bin/nowcoding.js heartbeat
```

The CLI token prompt must not echo the token. If local parser data is unavailable, the fixture seed still exercises the deployed ingest and heartbeat APIs.

## Smoke Gate

```bash
NOWCODING_SMOKE_BASE_URL="$NOWCODING_RC_BASE_URL" NOWCODING_SMOKE_PUBLIC_ONLY=true pnpm smoke
NOWCODING_SMOKE_BASE_URL="$NOWCODING_RC_BASE_URL" NOWCODING_SMOKE_EXPECT_DATA=true pnpm smoke
```

Full smoke must pass after schema push and data seed.

## Package Gate

```bash
pnpm pack:cli:check
```

The dry-run must include the CLI bin, compiled dist output, README, license, and package metadata. It must exclude source, tests, local config, caches, and generated state.

## Privacy Gate

Redeploy with `NOWCODING_SHOW_COST=false`, then run:

```bash
NOWCODING_SMOKE_BASE_URL="$NOWCODING_RC_BASE_URL" NOWCODING_SMOKE_PUBLIC_ONLY=true pnpm smoke
```

Confirm the profile, card, badges, and OG image do not reveal cost.

Redeploy with `NOWCODING_SHOW_LIVE=false`, then run:

```bash
NOWCODING_SMOKE_BASE_URL="$NOWCODING_RC_BASE_URL" NOWCODING_SMOKE_PUBLIC_ONLY=true pnpm smoke
```

Confirm live status is hidden or private.

## Final Report

Record:

- commit SHA
- local CI gate result
- local production gate result
- Vercel deployment URL
- Postgres schema push result
- data seed result
- CLI sync result
- CLI heartbeat result
- public smoke result
- full smoke result
- privacy gate result
- package dry-run result
- blocked gates with the missing operator value or external service failure

Unset secrets before closing the terminal:

```bash
unset NOWCODING_SMOKE_TOKEN
unset NOWCODING_DEPLOY_DATABASE_URL
unset NOWCODING_RC_CRON_SECRET
```
