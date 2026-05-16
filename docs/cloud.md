# NowCoding Cloud V2 architecture

NowCoding Cloud V2 uses a Supabase-first backend with a separate public web
surface. Supabase owns identity, storage, and lightweight API execution; the
web app owns product pages, profiles, SVG cards, badges, and Arena UI.

## Recommended stack

```text
https://nowcoding.cc
        |
        v
Next.js on Vercel or Cloudflare Pages
  - product site
  - login entry and OAuth callback pages
  - official profiles
  - README card and badge SVG routes
  - Arena leaderboard UI
        |
        v
Supabase
  - Auth with GitHub OAuth
  - Postgres for accounts, devices, usage buckets, profiles, streaks, and Arena
  - Edge Functions for short Cloud API requests
  - Scheduled Functions or pg_cron for aggregation
  - RLS and service-role-only admin operations
```

## Boundary decisions

- CLI stays open source and performs local collection, privacy trimming, and
  upload.
- Self-hosted web stays open source and can use any standard Postgres
  connection string.
- Official Cloud uses Supabase Auth and Postgres under `https://nowcoding.cc`.
- Arena remains opt-in. Cloud profile/card/badge upload must work without Arena
  participation.
- Edge Functions handle short API requests such as device registration, usage
  ingest, Arena join/leave, and profile settings. Heavy aggregation,
  anti-abuse scoring, and backfills should run as scheduled SQL/jobs or later
  move to a worker service.

## Database connection

For Supabase, set `DATABASE_URL` to the transaction pooler URL from Project
Settings > Database, not a browser API URL.

```env
DATABASE_URL=postgresql://postgres.<project-ref>:password@aws-0-region.pooler.supabase.com:6543/postgres?sslmode=require
DATABASE_MAX_CONNECTIONS=1
```

The runtime database client uses the standard Postgres protocol with prepared
statements disabled so it works with Supabase pooler mode.

## Required Cloud env

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
SUPABASE_SERVICE_ROLE_KEY=<server-only secret key>
DATABASE_URL=<Supabase pooler URL>
DATABASE_MAX_CONNECTIONS=1
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` in client components, browser bundles,
or `NEXT_PUBLIC_` variables.

## Initial route contract

- `https://nowcoding.cc` product, login, and account entry.
- `https://nowcoding.cc/<username>` official public profile.
- `https://nowcoding.cc/<username>/card.svg` README card.
- `https://nowcoding.cc/<username>/badge/<type>.svg` badges.
- `https://nowcoding.cc/arena` opt-in public leaderboard.

## Implementation phases

1. Configure Supabase project, GitHub OAuth, and `nowcoding.cc` callback URLs.
2. Add account and device tables with RLS, keeping service-role writes on the
   server only.
3. Wire `nowcoding login` to Supabase-backed Cloud device registration.
4. Move official profile, card, badge, and Arena reads to Cloud account data.
5. Add scheduled aggregation for leaderboard ranges, streaks, and anti-abuse
   signals.
