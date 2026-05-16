# Contributing to NowCoding

Thanks for helping improve NowCoding. This repository is the open-source
self-hosted project: CLI collection, parsers, daemon, shared protocol code, and
the single-tenant web app.

## Project Boundaries

- Keep official Cloud, Arena, anti-abuse operations, billing, and admin-only
  code out of this repository.
- Do not commit real user usage data, local AI tool logs, prompt text, database
  dumps, device tokens, API tokens, OAuth secrets, or production environment
  values.
- Internal planning documents such as `docs/superpowers/`,
  `nowcoding-prd.md`, and `nowcoding-tech-spec.md` are intentionally ignored in
  the public repository.

## Development Setup

```bash
corepack enable
pnpm install
pnpm typecheck
pnpm test
pnpm lint
```

For the web app, copy `.env.example` to `.env.local` and fill in local values.
Do not commit `.env.local`.

## Before Opening a Pull Request

Run the checks that match your change:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @nowcoding/web build
```

Parser changes should include fixtures and update `docs/parsers.md` when
coverage or support status changes.

## Pull Request Guidelines

- Keep changes scoped to one feature or fix.
- Include tests for parser behavior, protocol changes, public rendering, and
  privacy-sensitive code.
- Document user-facing changes in `README.md` or files under `docs/`.
- Explain any skipped checks in the PR description.

## Security

Report vulnerabilities through GitHub Security Advisories or the address listed
in `SECURITY.md`. Do not open public issues for token leaks, auth bypasses, or
privacy regressions.
