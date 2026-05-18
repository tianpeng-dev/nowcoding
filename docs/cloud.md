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

## Current product decisions

- The public OSS template remains `github.com/tianpeng-dev/nowcoding`.
  `github.com/nowcoding-dev` is reserved as a brand-protection organization and
  should not be treated as the canonical source repo unless the project is
  intentionally migrated later.
- The official domain is `https://nowcoding.cc`. Root-level self-host routes
  such as `/card.svg`, `/badge/today.svg`, `/api/stats`, `/api/now`, and
  `/api/heatmap` belong to a user's self-hosted deployment. Cloud official
  surfaces are username-scoped: `/<username>`, `/<username>/card.svg`, and
  `/<username>/badge/<type>.svg`.
- The `nowcoding` npm package is the real user-facing CLI entrypoint. The
  current `0.0.1` npm packages are brand placeholders; Cloud and self-hosted
  onboarding are not complete until a real CLI build is published under
  `nowcoding`.
- The v1.5 macOS app, if built, is a menu bar companion for daemon health, sync
  state, logs, privacy checks, and profile/card shortcuts. It is not part of
  the v1 launch path and should not become a separate dashboard product.

## Cloud CLI login UX

The desired happy path is one smooth browser login, not a second manual device
confirmation step:

```text
nowcoding login
  -> CLI creates a short-lived login session and opens the browser
  -> user signs in with GitHub OAuth
  -> Cloud validates the CLI-initiated session and binds the device
  -> browser shows "NowCoding CLI is connected. You can close this tab."
  -> CLI saves a NowCoding device token and prints the profile/card links
```

Security comes from the protocol rather than asking the user to click an extra
button. The login session must be high entropy, short lived, single use, and
bound to the CLI that initiated it. Prefer PKCE or an equivalent verifier so a
stolen callback or poll token cannot mint a device token by itself.

The CLI must never store a GitHub OAuth token. It stores only a NowCoding device
token scoped to usage ingest, heartbeat, device status, and other explicitly
allowed CLI operations. Account settings, billing, admin actions, and destructive
operations must remain out of scope for device tokens.

Risk-based confirmation is still allowed for unusual cases, such as expired
sessions, too many new devices, suspicious account activity, or Arena/public
field consent changes. Normal `nowcoding login` should complete without a
separate "Confirm this device" page.

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
3. Wire `nowcoding login` to CLI-initiated GitHub OAuth, implicit device
   binding, scoped device tokens, and local config persistence.
4. Move official profile, card, badge, and Arena reads to Cloud account data.
5. Add scheduled aggregation for leaderboard ranges, streaks, and anti-abuse
   signals.
