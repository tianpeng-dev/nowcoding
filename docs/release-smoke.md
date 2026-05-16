# NowCoding v1 Release Smoke Checklist

Run this before tagging or announcing v1.0.

Set the release candidate base URL before running deployment or smoke commands:

```bash
export NOWCODING_RC_BASE_URL="https://rc.example.invalid"
```

Replace the sentinel value with the real Vercel preview URL.

## Local CI Gate

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @nowcoding/web build
```

## Deploy Gate

1. Deploy `main` to Vercel.
2. Confirm the production Postgres `DATABASE_URL` exists.
3. Run schema push once:
   ```bash
   read -rs NOWCODING_DEPLOY_DATABASE_URL
   DATABASE_URL="$NOWCODING_DEPLOY_DATABASE_URL" pnpm db:push
   unset NOWCODING_DEPLOY_DATABASE_URL
   ```
4. Visit the setup page for the deployment:
   ```text
   $NOWCODING_RC_BASE_URL/setup
   ```
5. Confirm Database, API token, Endpoint, and Profile cards are ready.
6. Generate or reveal the token in Vercel Project Settings. Do not paste it into issue trackers, screenshots, or shell history.
7. Initialize the local CLI against the deployed endpoint:
   ```bash
   pnpm --filter nowcoding build
   node apps/cli/bin/nowcoding.js init --endpoint "$NOWCODING_RC_BASE_URL"
   node apps/cli/bin/nowcoding.js sync
   node apps/cli/bin/nowcoding.js heartbeat
   ```
   Paste the token at the hidden prompt. For non-interactive automation, provide the token through the environment supported by that automation rather than putting secrets in shared logs.

## Public Surface Gate

Run public-only smoke first:

```bash
NOWCODING_SMOKE_BASE_URL="$NOWCODING_RC_BASE_URL" NOWCODING_SMOKE_PUBLIC_ONLY=true pnpm smoke
```

Read and export the token, seed controlled data when the deployed database needs a known fixture, then run full smoke with data expectations:

```bash
read -rs NOWCODING_SMOKE_TOKEN
export NOWCODING_SMOKE_TOKEN
NOWCODING_SMOKE_BASE_URL="$NOWCODING_RC_BASE_URL" pnpm smoke:seed
NOWCODING_SMOKE_BASE_URL="$NOWCODING_RC_BASE_URL" NOWCODING_SMOKE_EXPECT_DATA=true pnpm smoke
unset NOWCODING_SMOKE_TOKEN
```

Expected public routes:

- `/`
- `/card.svg`
- `/badge/today.svg`
- `/badge/week.svg`
- `/badge/total.svg`
- `/badge/model.svg`
- `/badge/streak.svg`
- `/badge/live.svg`
- `/og/profile.png`
- `/api/stats`
- `/api/now`
- `/api/heatmap`

Expected private route:

- `/api/usage/settings` rejects unauthenticated requests.
- `/api/usage/settings` returns JSON with a valid Bearer token.

## Privacy Gate

1. Set `NOWCODING_SHOW_COST=false`, redeploy, and confirm public card/profile/badges/OG do not reveal cost.
2. Set `NOWCODING_SHOW_LIVE=false`, redeploy, and confirm live status is hidden/private.
3. Keep `NOWCODING_UPLOAD_PROJECT=false` unless you intentionally want project names public.
