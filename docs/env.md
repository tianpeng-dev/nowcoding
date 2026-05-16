# Environment variables

All variables are read in `apps/web/lib/env.ts` via Zod and fall back to safe
defaults where possible.

These variables configure the open-source self-hosted server. Hosted V2 Cloud is
configured by `nowcoding login`; the CLI stores its Cloud device token locally
after GitHub OAuth and Cloud upload consent.

Official hosted Cloud uses `https://nowcoding.cc`. Self-hosted deployments keep
their own deployment origin through `NOWCODING_WEBSITE_URL`.

Self-hosted mode does not contact NowCoding Cloud or Arena unless you explicitly
run `nowcoding login` or `nowcoding arena connect`.

| Variable | Required? | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | ✅ in production | – | Standard Postgres connection string. For Cloud V2 on Supabase, use the transaction pooler URL. |
| `DATABASE_MAX_CONNECTIONS` | optional | `1` | Runtime Postgres connection cap for serverless pooler mode. |
| `NEXT_PUBLIC_SUPABASE_URL` | Cloud only | – | Supabase project URL for the official hosted Cloud path. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Cloud only | – | Supabase browser-safe publishable key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Cloud only | – | Server-only Supabase key for trusted Cloud API operations. Never expose to client code. |
| `NOWCODING_USERNAME` | ✅ | `alice` | Public handle shown on profile and badges. |
| `NOWCODING_API_TOKEN` | ✅ | – | Bearer token for CLI ingest. Generate with `npx nowcoding gen-token`. Format `nc_live_<32 base64url chars>`. |
| `NOWCODING_GITHUB_HANDLE` | optional | – | Used for avatar (`https://github.com/<handle>.png`). |
| `NOWCODING_DISPLAY_NAME` | optional | username | Display string. |
| `NOWCODING_BIO` | optional | – | Short bio shown on profile. |
| `NOWCODING_WEBSITE_URL` | optional | – | Public deployment origin or custom domain, such as `https://you.example.com`. Used for setup commands and public metadata. |
| `NOWCODING_LOCATION` | optional | – | Free-text location. |
| `NOWCODING_TIMEZONE` | optional | `UTC` | IANA timezone for streak and heatmap day boundaries. |
| `NOWCODING_UPLOAD_PROJECT` | optional | `false` | If `true`, allows the CLI to upload raw project names (otherwise replaced with `unknown`). Server-side AND-gate. |
| `NOWCODING_UPLOAD_HOSTNAME` | optional | `true` | If `false`, hostname becomes `unknown` (multi-machine views collapse). |
| `NOWCODING_SHOW_COST` | optional | `true` | Whether public endpoints show estimated cost. |
| `NOWCODING_SHOW_LIVE` | optional | `true` | Whether public endpoints show live status. |
| `CRON_SECRET` | ✅ in production | – | Strong random secret for cron auth. Add it to Vercel env vars; Vercel sends it as a `Bearer` authorization header when invoking cron jobs. |

Vercel recommends adding `CRON_SECRET` yourself and using a random string of at
least 16 characters. See the
[Vercel Cron Jobs docs](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

When Vercel system environment variables are exposed to the app, `/setup` can
fall back to `VERCEL_PROJECT_PRODUCTION_URL` and then `VERCEL_URL` to infer the
public endpoint. Set `NOWCODING_WEBSITE_URL` when you use a custom domain or
want a stable origin independent of preview deployment URLs.

## Supabase Cloud

For the official hosted path, create a Supabase project and use the database
transaction pooler URL as `DATABASE_URL`:

```env
DATABASE_URL=postgresql://postgres.<project-ref>:password@aws-0-region.pooler.supabase.com:6543/postgres?sslmode=require
DATABASE_MAX_CONNECTIONS=1
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
SUPABASE_SERVICE_ROLE_KEY=<server-only secret key>
```

See [docs/cloud.md](cloud.md) for the Cloud V2 architecture and boundaries.

## Local dev

Copy [.env.example](../.env.example) to `apps/web/.env.local` and fill in the
required keys. Next.js auto-loads `.env.local` for `pnpm dev`.

For non-Next scripts (drizzle-kit, custom tsx scripts), pass `DATABASE_URL`
inline:

```bash
DATABASE_URL='postgres://...' pnpm --filter @nowcoding/db push
```

## Privacy fail-closed

Server settings only **tighten** local CLI privacy; they cannot relax it.
See `packages/core/src/privacy.ts` (and 8 unit tests in
`packages/core/tests/privacy.test.ts`) for the AND logic.

If the CLI cannot reach `/api/usage/settings` it treats every flag as `false`
— uploads sanitised data only.

## NowCoding Cloud consent

For the hosted path:

```bash
npm install -g nowcoding
nowcoding login
nowcoding daemon install
```

`nowcoding login` opens GitHub OAuth and asks whether the CLI may upload
aggregate usage buckets to NowCoding Cloud. "Join NowCoding Arena" is checked by
default, but the prompt shows the public profile and leaderboard fields before
confirmation and can be unchecked.
