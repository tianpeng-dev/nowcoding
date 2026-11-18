# NowCoding Cloud Deployment

## Production Origin

The intended production origin is `https://nowcoding.cc`. Treat it as ready
only after the Vercel production domain check, Cloudflare DNS/TLS check, and
production smoke pass.

## Required Services

- Vercel project for the public `tianpeng-dev/nowcoding` repository.
  This must be a separate project from the public OSS `nowcoding` deployment.
  Configure the project with Framework Preset `Next.js` and Root Directory
  `apps/cloud`.
- Supabase project for Postgres. Auth and Edge Functions are reserved for later
  Cloud phases; the current auth flow exchanges GitHub OAuth directly through
  Next.js routes.
- Cloudflare zone for `nowcoding.cc`.
- Cron configuration for scheduled leaderboard jobs.

## Required Environment Variables

Use the required values from `apps/cloud/.env.example`. `DATABASE_URL` must be the Supabase
transaction pooler URL. Supabase Auth variables in `apps/cloud/.env.example` are commented
placeholders for a future integration and are not required by the current direct
GitHub OAuth flow.

```env
DATABASE_URL=
DATABASE_MAX_CONNECTIONS=1
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_OAUTH_STATE_SECRET=
NOWCODING_CLOUD_URL=https://nowcoding.cc
CRON_SECRET=
ADMIN_GITHUB_LOGINS=peng

# Optional future session management
# SESSION_SECRET=

# Optional future Supabase Auth integration
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
# SUPABASE_SERVICE_ROLE_KEY=
```

Reserved for future Supabase Auth integration: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. If
`SUPABASE_SERVICE_ROLE_KEY` is enabled later, it must only be set in Vercel
server environments. Never expose it to browser or CLI code, and never use a
`NEXT_PUBLIC_` prefix.

Reserved for future session management: `SESSION_SECRET`. The current direct
GitHub OAuth flow signs OAuth state and temporary GitHub identity cookies with
`GITHUB_OAUTH_STATE_SECRET`, falling back to `GITHUB_CLIENT_SECRET`.

## Callback URLs

- GitHub OAuth callback: `https://nowcoding.cc/api/auth/github/callback`

## Supported Launch Commands

Apply database schema through the Supabase transaction pooler:

```bash
read -rsp 'Supabase DATABASE_URL: ' SUPABASE_POOLER_URL; export SUPABASE_POOLER_URL; echo
DATABASE_URL="$SUPABASE_POOLER_URL" pnpm db:cloud:apply
```

Run safe, non-mutating HTTP smoke:

```bash
NOWCODING_SMOKE_USERNAME=tianpeng-dev pnpm smoke:cloud https://nowcoding.cc
```

Run mutating smoke only after staging has passed, or with explicit production
approval. This creates auth flow rows and can write leaderboard snapshots:

```bash
read -rsp 'Smoke CRON_SECRET: ' SMOKE_CRON_SECRET; export SMOKE_CRON_SECRET; echo
NOWCODING_SMOKE_INCLUDE_MUTATING=1 CRON_SECRET="$SMOKE_CRON_SECRET" pnpm smoke:cloud https://nowcoding.cc --include-mutating
```

Use the
[production readiness checklist](deployment-checklists/production-readiness.md)
for the full staging and production gate sequence.

## Deployment Steps

1. Create the Supabase project and enable Postgres.
2. Copy the Supabase transaction pooler connection string into `DATABASE_URL`.
3. Configure the GitHub OAuth app callback listed above.
4. Create the Vercel project from `tianpeng-dev/nowcoding` with Root
   Directory `apps/cloud`. Enable access to workspace files outside the root directory.
5. Set all required environment variables in Vercel production.
6. Configure Cron for `POST /api/jobs/leaderboard` with
   `Authorization: Bearer ${CRON_SECRET}`.
7. Add `nowcoding.cc` to the Vercel project domains.
8. Configure the Cloudflare `nowcoding.cc` zone to point the apex domain at
   Vercel.
9. Apply the checked-in Cloud schema with `pnpm db:cloud:apply` before production
   traffic.
10. Verify RLS remains enabled on Cloud tables before exposing production
    traffic.
11. Deploy the Vercel production build.

## Supabase RLS

Keep RLS enabled on Cloud tables in the public schema. Public profile, card, and
leaderboard data must go through application routes, not direct Supabase client
table reads. If a later phase enables `SUPABASE_SERVICE_ROLE_KEY` for trusted
API routes or jobs, that key is server-only and must never be shipped to
browsers, the CLI, user config, or logs.

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
NOWCODING_SMOKE_USERNAME=tianpeng-dev pnpm smoke:cloud https://nowcoding.cc
```
