# NowCoding Cloud

The public NowCoding workspace contains the hosted Next.js app in `apps/cloud`, its account and leaderboard logic in `packages/cloud-core` and its Postgres migrations in `packages/cloud-db`. The Magpie plugin and CLI use the same collection and device protocol.

GitHub OAuth binds a device through `/api/auth/cli/start` and `/api/auth/cli/poll`. The local client stores the scoped device token. Authenticated devices send usage to `/api/cloud/usage/ingest` and presence to `/api/cloud/usage/heartbeat`. Account settings and device revocation run in the authenticated website. Joining the leaderboard is optional.

Public profiles, cards and badges use `/u/{username}`. Self-hosted installations serve equivalent routes from the root of their own domain.

See [Cloud deployment](cloud-deploy.md) and [self-hosted deployment](deploy.md).
