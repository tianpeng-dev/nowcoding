# Security

## Reporting

Email security@nowcoding.cc (or open a GitHub Security Advisory) with details.
We aim to acknowledge within 72 hours.

## Threat model (v1.0, single-tenant self-hosted)

- **API token compromise**: Single Bearer token (`NOWCODING_API_TOKEN`).
  Mitigation: timing-safe comparison (`crypto.timingSafeEqual`); rotate via
  Vercel dashboard if leaked.
- **Privacy regression**: Local CLI privacy MUST AND with server settings; the
  server cannot relax local privacy. Network failure → fail-closed.
- **SQL injection**: All DB access goes through Drizzle parameterized queries;
  no raw string SQL.
- **Session ID leakage**: Original session IDs never leave the CLI; only the
  first 16 hex chars of `sha256(sessionId)` are stored.
- **Cron tampering**: `/api/cron/aggregate` requires `Authorization: Bearer
  ${CRON_SECRET}` (Vercel auto-injects in production).

## Out of scope (v1.0)

Anti-cheat / data-validation against malicious self-hosters. Each instance is
its owner's; abuse of one's own data has no blast radius beyond that
deployment.
