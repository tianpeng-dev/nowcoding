# NowCoding Cloud Production Readiness Checklist

## Rule

Do not cut production traffic until staging passes every gate below.

## Staging Supabase

- [ ] Create or select the `nowcoding-cloud-staging` Supabase project.
- [ ] Confirm the Supabase connector can see the project, or keep the
      transaction pooler URL available locally. The current connector must show
      a `project_id` before MCP migrations/advisors can run.
- [ ] Copy the Supabase Postgres transaction pooler URL.
- [ ] Apply the checked-in schema twice:

```bash
read -rsp 'Staging DATABASE_URL: ' STAGING_DATABASE_URL; export STAGING_DATABASE_URL; echo
DATABASE_URL="$STAGING_DATABASE_URL" pnpm db:cloud:apply
DATABASE_URL="$STAGING_DATABASE_URL" pnpm db:cloud:apply
```

Expected: the first `pnpm db:cloud:apply` applies pending migrations; the second
`pnpm db:cloud:apply` succeeds and skips already applied migrations.

## Vercel Preview

- [ ] Create a separate Vercel project for `tianpeng-dev/nowcoding`.
      Do not reuse the public OSS `nowcoding` project.
- [ ] Use these project settings:
  - Framework Preset: `Next.js`
  - Root Directory: `apps/cloud`
  - Build Command: keep Vercel's default Turbo/Next.js build unless it fails;
    Vercel can infer the Turborepo filter from the configured root directory.
  - Output Directory: default
- [ ] Link the local checkout to that Cloud project:

```bash
pnpm dlx vercel link
```

- [ ] Add Preview environment variables:

```bash
pnpm dlx vercel env add DATABASE_URL preview
pnpm dlx vercel env add DATABASE_MAX_CONNECTIONS preview
pnpm dlx vercel env add GITHUB_CLIENT_ID preview
pnpm dlx vercel env add GITHUB_CLIENT_SECRET preview
pnpm dlx vercel env add GITHUB_OAUTH_STATE_SECRET preview
pnpm dlx vercel env add NOWCODING_CLOUD_URL preview
pnpm dlx vercel env add CRON_SECRET preview
pnpm dlx vercel env add ADMIN_GITHUB_LOGINS preview
```

- [ ] Set `NOWCODING_CLOUD_URL` to the Vercel Preview deployment URL.
- [ ] Configure a GitHub OAuth staging app callback:

```text
$PREVIEW_URL/api/auth/github/callback
```

- [ ] Deploy Preview:

```bash
PREVIEW_URL="$(pnpm dlx vercel deploy)"
printf '%s\n' "$PREVIEW_URL"
```

- [ ] Run safe, non-mutating HTTP smoke:

```bash
pnpm smoke:cloud "$PREVIEW_URL"
```

Expected: smoke passes without creating auth rows or rebuilding leaderboard
snapshots.

## Manual Preview OAuth and CLI Gate

- [ ] Start CLI login against Preview.
- [ ] Complete GitHub OAuth in the browser.
- [ ] Confirm the device code in `/login/device`.
- [ ] Poll until the CLI receives a device token.
- [ ] Ingest one test payload.
- [ ] Confirm `/u/{username}/card.svg` returns `200` and `image/svg+xml`.
- [ ] Confirm `/leaderboard` returns `200`.

## Production Supabase

- [ ] Create or select the `nowcoding-cloud-production` Supabase project.
- [ ] Apply the production schema:

```bash
read -rsp 'Production DATABASE_URL: ' PROD_DATABASE_URL; export PROD_DATABASE_URL; echo
DATABASE_URL="$PROD_DATABASE_URL" pnpm db:cloud:apply
```

Expected: migrations apply successfully.

## Vercel Production

- [ ] Confirm the linked Vercel project serves apps/cloud separately from the
      public OSS project:

```bash
test -f .vercel/project.json && cat .vercel/project.json
pnpm dlx vercel project ls
```

Expected: `.vercel/project.json` points to the private Cloud Vercel project id,
not the existing public OSS `nowcoding` project.

- [ ] Add Production environment variables:

```bash
pnpm dlx vercel env add DATABASE_URL production
pnpm dlx vercel env add DATABASE_MAX_CONNECTIONS production
pnpm dlx vercel env add GITHUB_CLIENT_ID production
pnpm dlx vercel env add GITHUB_CLIENT_SECRET production
pnpm dlx vercel env add GITHUB_OAUTH_STATE_SECRET production
pnpm dlx vercel env add NOWCODING_CLOUD_URL production
pnpm dlx vercel env add CRON_SECRET production
pnpm dlx vercel env add ADMIN_GITHUB_LOGINS production
```

- [ ] Configure the GitHub OAuth production app:

```text
Homepage URL: https://nowcoding.cc
Authorization callback URL: https://nowcoding.cc/api/auth/github/callback
```

- [ ] Deploy production:

```bash
CLOUD_URL="$(pnpm dlx vercel deploy --prod)"
printf '%s\n' "$CLOUD_URL"
```

## Cloudflare

- [ ] Ensure `nowcoding.cc` is added as a Vercel production domain.
- [ ] Ensure Cloudflare DNS points the apex domain to the Vercel DNS target.
- [ ] Confirm the Cloudflare connector is authenticated if DNS will be managed
      from Codex. Otherwise verify DNS from the Cloudflare dashboard and public
      DNS queries.
- [ ] Confirm public DNS and HTTPS are usable before OAuth or production smoke:

```bash
dig +short nowcoding.cc A
dig +short nowcoding.cc CNAME
curl -I --max-time 20 https://nowcoding.cc
```

Expected: DNS points to the intended Cloudflare/Vercel path and `curl` returns
an HTTP response instead of timing out.

- [ ] If using an apex CNAME, rely on Cloudflare CNAME flattening.
- [ ] Start DNS-only if TLS, OAuth callback, or routing behavior is uncertain.
- [ ] Enable Cloudflare proxy/WAF only after production smoke passes.

## Production Smoke

Run safe, non-mutating HTTP smoke:

```bash
pnpm smoke:cloud https://nowcoding.cc
```

Expected: smoke passes without creating auth rows or rebuilding leaderboard
snapshots.

## Explicit Mutating Checks

Run these checks only after staging has passed, or with explicit production
approval. They create auth flow rows and can write leaderboard snapshots.

```bash
read -rsp 'CRON_SECRET: ' SMOKE_CRON_SECRET; export SMOKE_CRON_SECRET; echo
NOWCODING_SMOKE_INCLUDE_MUTATING=1 CRON_SECRET="$SMOKE_CRON_SECRET" pnpm smoke:cloud "$CLOUD_URL" --include-mutating
```

Use the Cron leaderboard job only as an explicit mutating, staging, or manual
gate. It is not part of default smoke.

## Production Manual Gate

- [ ] GitHub OAuth completes.
- [ ] CLI login returns a device token.
- [ ] Ingest returns `200`.
- [ ] `/u/{username}/card.svg` returns `200` and `image/svg+xml`.
- [ ] `/api/jobs/leaderboard` returns `200` with `CRON_SECRET` during the
      explicit mutating/manual gate.
- [ ] `/leaderboard` returns `200`.
- [ ] Unauthorized ingest returns `401`.

## Rollback

If production smoke fails after deployment:

1. Roll back Vercel to the previous deployment from the dashboard or CLI.
2. Disable Cloudflare proxy if DNS, TLS, WAF, or callback routing is suspected.
3. Restore DNS-only mode while validating Vercel origin behavior.
4. Do not edit production schema manually unless the failed migration is
   understood and a forward fix or restore plan is written.
5. Record the failing command, response status, and response body before
   retrying.
