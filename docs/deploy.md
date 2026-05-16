# Deploy NowCoding to Vercel

NowCoding is single-tenant: each developer hosts their own instance and gets a
public profile at `https://your-name.vercel.app`.

Self-hosted mode does not contact NowCoding Cloud or Arena unless you explicitly
run `nowcoding login` or `nowcoding arena connect`.

## Hosted Cloud path

If you do not want to deploy a server, use the hosted V2 Cloud flow:

```bash
npm install -g nowcoding
nowcoding login
nowcoding daemon install
```

Official Cloud will be served from `https://nowcoding.cc`. The hosted flow is
expected to return links such as `https://nowcoding.cc/<username>`,
`https://nowcoding.cc/<username>/card.svg`, and
`https://nowcoding.cc/<username>/badge/streak.svg`.

`nowcoding login` opens GitHub OAuth, asks for Cloud upload consent, and returns
official profile/card/badge links. "Join NowCoding Arena" is checked by default
for leaderboard participation, but the confirmation prompt shows the public
fields first and lets you uncheck it.

## One-click deploy

Use the public `tianpeng-dev/nowcoding` template to create a self-hosted Vercel
deployment:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ftianpeng-dev%2Fnowcoding&env=NOWCODING_USERNAME,NOWCODING_API_TOKEN,CRON_SECRET&envDescription=Set%20your%20public%20NowCoding%20username%2C%20paste%20a%20secret%20token%20from%20%60npx%20nowcoding%20gen-token%60%2C%20and%20add%20a%20strong%20random%20cron%20secret.&envLink=https%3A%2F%2Fgithub.com%2Ftianpeng-dev%2Fnowcoding%2Fblob%2Fmain%2Fdocs%2Fenv.md&project-name=nowcoding&repository-name=nowcoding)

1. Run `npx nowcoding gen-token` locally.
2. Open the Vercel deploy button above.
3. Enter `NOWCODING_USERNAME`, paste the generated token into `NOWCODING_API_TOKEN`, and add a strong random `CRON_SECRET`.
4. After deploy, add a Supabase Postgres pooler URL or another standard Postgres `DATABASE_URL`.
5. From your local clone, run `DATABASE_URL='<from Postgres>' pnpm db:push` once.
6. Visit `https://your-deployment.vercel.app/setup` and confirm Database, API token, Endpoint, and Profile are ready. The wizard checks that secrets exist but never renders secret values.
7. Run `npx nowcoding init --endpoint https://your-deployment.vercel.app` and paste the token when prompted.
8. Run `npx nowcoding sync`, then check `/`, `/card.svg`, `/badge/today.svg`, `/badge/live.svg`, `/api/stats`, `/api/now`, and `/api/heatmap`.

## Manual flow

1. **Fork** this repo (or push your own clone to GitHub).
2. **Generate an API token** locally:
   ```bash
   npx nowcoding gen-token
   # → nc_live_xxxx... (paste this into NOWCODING_API_TOKEN)
   ```
3. **Create a Vercel project** pointing at your fork.
4. **Provision Postgres**. For Cloud V2, use Supabase and copy the transaction
   pooler URL from Project Settings > Database. Self-hosted deployments may use
   Supabase or another standard Postgres provider.
5. **Set env vars** in Vercel → Project → Settings → Environment Variables.

   | Name | Required | Note |
   |---|---|---|
   | `DATABASE_URL` | ✅ | Supabase pooler URL or standard Postgres connection string |
   | `DATABASE_MAX_CONNECTIONS` | optional | `1`; keep low for serverless pooler mode |
   | `NOWCODING_USERNAME` | ✅ | your public handle |
   | `NOWCODING_API_TOKEN` | ✅ | from step 2; treat as secret |
   | `CRON_SECRET` | ✅ | strong random production secret for cron auth |
   | `NOWCODING_GITHUB_HANDLE` | optional | for avatar |
   | `NOWCODING_DISPLAY_NAME` | optional | default = username |
   | `NOWCODING_BIO` | optional | one-line bio |
   | `NOWCODING_TIMEZONE` | optional | `UTC`; use your local IANA timezone |
   | `NOWCODING_UPLOAD_PROJECT` | optional | `false` (default) |
   | `NOWCODING_UPLOAD_HOSTNAME` | optional | `true` (default) |
   | `NOWCODING_SHOW_COST` | optional | `true`; controls public estimated cost |
   | `NOWCODING_SHOW_LIVE` | optional | `true`; controls public live status |

   - Set `NOWCODING_TIMEZONE` to your local IANA timezone, such as `Asia/Shanghai` or `America/Los_Angeles`.
   - Decide whether estimated cost should be public with `NOWCODING_SHOW_COST`.
   - Decide whether live status should be public with `NOWCODING_SHOW_LIVE`.
   - Set `CRON_SECRET` to a password-manager generated value. Vercel sends it
     as a `Bearer` authorization header when invoking cron jobs; see the
     [Vercel Cron Jobs docs](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
6. **Push schema** once after the first deploy:
   ```bash
   DATABASE_URL='<from Postgres>' pnpm db:push
   ```
7. **Visit** `https://your-name.vercel.app/setup` to confirm everything wired up.
8. **Run the CLI** locally:
   ```bash
   npx nowcoding init --endpoint https://your-name.vercel.app
   npx nowcoding sync
   npx nowcoding heartbeat
   npx nowcoding sync --watch
   ```
   Paste your token at the local prompt. Use `nowcoding init --token` only for
   automation where an interactive prompt is not available.
   Run `nowcoding heartbeat` for one-shot freshness. Run `nowcoding sync --watch`
   for continuous live badge updates between full syncs.

## What gets cached / rebuilt

- Profile page: ISR, regenerates every 60 seconds
- Badges + card SVGs: 5-minute Vercel CDN cache
- OG images: 1-hour CDN cache
- Cron job: `/api/cron/aggregate` runs daily at UTC 00:00 (refreshes owner
  profile aggregates; streak and heatmap use `NOWCODING_TIMEZONE`). Production
  cron requests require `CRON_SECRET`.

## Rotating the API token

If your token leaks, edit it in Vercel → Environment Variables, redeploy, and
re-run `nowcoding init --endpoint https://your-name.vercel.app` locally, then
paste the new value when prompted. Old token immediately stops working because
the verify path uses `crypto.timingSafeEqual` against the current env value.
