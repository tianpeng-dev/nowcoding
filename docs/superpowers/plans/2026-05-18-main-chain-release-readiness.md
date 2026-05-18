# NowCoding Main Chain Release Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the three primary NowCoding launch paths executable and verified: real npm CLI, OSS self-host deployment, and Cloud login/profile/card/badge.

**Architecture:** Treat the public OSS repo and private Cloud repo as separate products with a shared CLI contract. The OSS repo owns `nowcoding` npm, local collection, self-host web, and self-host smoke; the private Cloud repo owns `nowcoding.cc`, GitHub OAuth, device tokens, hosted profile/card/badge, and Arena. Keep the v1.5 macOS helper deferred until these core paths are green.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, Next.js App Router, Vercel, Supabase Postgres, Drizzle ORM, npm publishing.

---

## File Structure

Public OSS repo `/Users/peng/Documents/Project/NowCoding`:

- Modify `README.md`, `README_zh.md`, `apps/cli/README.md`, `docs/cloud.md`, `docs/deploy.md`, `docs/env.md`, and `docs/v1.5-backlog.md` only to lock the product decisions already captured.
- Modify `apps/cli/package.json` to release a real CLI version.
- Modify `apps/cli/src/index.ts` so `nowcoding --version` reports the release version.
- Modify `apps/cli/src/lib/api.ts` so the `X-NowCoding-Client` header reports the release version.
- Modify `apps/cli/tests/api.test.ts` and create `apps/cli/tests/version.test.ts` to make version reporting testable.
- Use existing `scripts/check-cli-pack.mjs`, `scripts/smoke.mjs`, and `scripts/seed-smoke-data.mjs` for package and self-host verification.

Private Cloud repo `/Users/peng/Documents/Project/nowcoding-cloud`:

- Modify `apps/cloud/app/api/auth/cli/start/route.ts` so CLI-started login returns a browser verification URL without a manual device code.
- Modify `apps/cloud/app/api/auth/github/callback/route.ts` to complete CLI-started device binding after GitHub OAuth when the OAuth state return path contains a valid flow token.
- Modify `apps/cloud/app/api/auth/_shared.ts` to add a flow-token based completion helper while retaining the existing confirmation helper until all tests and docs move off manual confirmation.
- Modify `apps/cloud/app/login/device/page.tsx` to show the success/failure result instead of a device-code form for the happy path.
- Modify `apps/cloud/tests/cli-auth-confirmation.test.ts` or create `apps/cloud/tests/cli-auth-implicit.test.ts` to cover implicit device binding.
- Modify `scripts/cloud-smoke.mjs` and `scripts/cloud-smoke.test.ts` so production smoke checks hosted profile, card, badge, and public JSON routes for a configured username.
- Modify private `README.md` and `docs/deploy.md` to describe the implicit device binding flow.

---

### Task 1: Commit Product Decision Docs

**Files:**
- Modify: `README.md`
- Modify: `README_zh.md`
- Modify: `apps/cli/README.md`
- Modify: `docs/cloud.md`
- Modify: `docs/deploy.md`
- Modify: `docs/env.md`
- Modify: `docs/v1.5-backlog.md`
- Create: `docs/superpowers/plans/2026-05-18-main-chain-release-readiness.md`

- [ ] **Step 1: Verify the docs contain the agreed boundaries**

Run:

```bash
rg -n "tianpeng-dev/nowcoding|nowcoding-dev|0\\.0\\.1|scoped NowCoding device token|macOS menu bar|/<username>/card\\.svg" README.md README_zh.md apps/cli/README.md docs/cloud.md docs/deploy.md docs/env.md docs/v1.5-backlog.md
```

Expected:

```text
docs/cloud.md contains tianpeng-dev/nowcoding and nowcoding-dev brand-protection wording.
docs/cloud.md contains current 0.0.1 npm packages are brand placeholders.
docs/cloud.md contains /<username>/card.svg.
README.md, README_zh.md, apps/cli/README.md, docs/deploy.md, and docs/env.md mention scoped NowCoding device token.
docs/v1.5-backlog.md contains macOS menu bar helper.
```

- [ ] **Step 2: Verify formatting and type-safe files**

Run:

```bash
pnpm lint
```

Expected:

```text
Checked ... files. No fixes applied.
```

- [ ] **Step 3: Commit the docs decision**

Run:

```bash
git add README.md README_zh.md apps/cli/README.md docs/cloud.md docs/deploy.md docs/env.md docs/v1.5-backlog.md
git add -f docs/superpowers/plans/2026-05-18-main-chain-release-readiness.md
git commit -m "docs: lock main chain release decisions"
```

Expected: commit succeeds on `main`.

---

### Task 2: Version the Real CLI Release Candidate

**Files:**
- Modify: `apps/cli/package.json`
- Modify: `apps/cli/src/index.ts`
- Modify: `apps/cli/src/lib/api.ts`
- Modify: `apps/cli/tests/api.test.ts`
- Create: `apps/cli/tests/version.test.ts`

- [ ] **Step 1: Add failing tests for CLI version output and client header**

Create `apps/cli/tests/version.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { main, VERSION } from '../src/index';

describe('CLI version', () => {
  it('exports the npm release candidate version', () => {
    expect(VERSION).toBe('0.1.0-alpha.1');
  });

  it('prints the npm release candidate version', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await main(['--version']);

    expect(log).toHaveBeenCalledWith('0.1.0-alpha.1');
  });
});
```

Edit `apps/cli/tests/api.test.ts` in the existing cloud ingest test so the client header assertion is exact:

```ts
expect(fetchMock.mock.calls[0]?.[1]).toEqual(
  expect.objectContaining({
    headers: expect.objectContaining({
      Authorization: `Bearer ${apiToken}`,
      'X-NowCoding-Client': 'nowcoding-cli/0.1.0-alpha.1',
    }),
  }),
);
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
pnpm -s vitest run apps/cli/tests/version.test.ts apps/cli/tests/api.test.ts
```

Expected: FAIL because `VERSION` is not exported and the client header still reports `nowcoding-cli/0.0.0`.

- [ ] **Step 3: Implement version constants**

In `apps/cli/package.json`, set:

```json
{
  "version": "0.1.0-alpha.1"
}
```

In `apps/cli/src/index.ts`, replace:

```ts
const VERSION = '0.0.0';
```

with:

```ts
export const VERSION = '0.1.0-alpha.1';
```

In `apps/cli/src/lib/api.ts`, replace:

```ts
const CLIENT_VERSION = 'nowcoding-cli/0.0.0';
```

with:

```ts
export const CLIENT_VERSION = 'nowcoding-cli/0.1.0-alpha.1';
```

- [ ] **Step 4: Verify targeted tests pass**

Run:

```bash
pnpm -s vitest run apps/cli/tests/version.test.ts apps/cli/tests/api.test.ts
```

Expected:

```text
2 test files passed
```

- [ ] **Step 5: Verify package dry run**

Run:

```bash
pnpm pack:cli:check
```

Expected:

```text
ok cli package dry-run
pack LICENSE
pack README.md
pack bin/nowcoding.js
pack dist/index.js
pack package.json
ok cli package install
```

- [ ] **Step 6: Commit the CLI release candidate version**

Run:

```bash
git add apps/cli/package.json apps/cli/src/index.ts apps/cli/src/lib/api.ts apps/cli/tests/api.test.ts apps/cli/tests/version.test.ts
git commit -m "chore: prepare cli alpha release"
```

Expected: commit succeeds.

---

### Task 3: Publish the Real CLI to npm `next`

**Files:**
- Read: `apps/cli/package.json`
- Read: `scripts/check-cli-pack.mjs`

- [ ] **Step 1: Run the local release gate**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm pack:cli:check
```

Expected: all commands pass.

- [ ] **Step 2: Confirm npm authentication**

Run:

```bash
npm whoami
```

Expected:

```text
tianpengdev
```

- [ ] **Step 3: Publish the alpha CLI**

Run:

```bash
cd /Users/peng/Documents/Project/NowCoding/apps/cli
npm publish --access public --tag next
```

Expected:

```text
+ nowcoding@0.1.0-alpha.1
```

If npm asks for Apple passkey authentication, open the URL npm prints, complete the browser flow, press Enter in the terminal if prompted, and wait for the publish command to finish.

- [ ] **Step 4: Verify npm dist-tag and executable package**

Run:

```bash
npm view nowcoding@next version
npx nowcoding@next --version
npx nowcoding@next --help
```

Expected:

```text
0.1.0-alpha.1
0.1.0-alpha.1
nowcoding 0.1.0-alpha.1
```

- [ ] **Step 5: Commit the npm publish note**

Append this line to `CHANGELOG.md` under the current unreleased section or at the top if no unreleased section exists:

```md
- Published `nowcoding@0.1.0-alpha.1` to npm under the `next` dist-tag for CLI smoke testing.
```

Run:

```bash
git add CHANGELOG.md
git commit -m "docs: record cli alpha publish"
```

Expected: commit succeeds.

---

### Task 4: Verify OSS Self-Hosted Deployment

**Files:**
- Read: `docs/deploy.md`
- Read: `docs/release-candidate.md`
- Read: `scripts/smoke.mjs`
- Read: `scripts/seed-smoke-data.mjs`

- [ ] **Step 1: Create or identify a Vercel preview deployment from the public repo**

Use the public template repo:

```text
https://github.com/tianpeng-dev/nowcoding
```

Set the Vercel project env vars:

```text
DATABASE_URL=<Supabase pooler or standard Postgres URL>
DATABASE_MAX_CONNECTIONS=1
NOWCODING_USERNAME=peng
NOWCODING_API_TOKEN=<nc_live token from npx nowcoding@next gen-token>
CRON_SECRET=<strong random secret>
NOWCODING_TIMEZONE=Asia/Shanghai
```

Expected: Vercel deployment succeeds and produces a preview or production URL.

- [ ] **Step 2: Export release candidate variables**

Run:

```bash
export NOWCODING_RC_BASE_URL="https://<real-self-host-deployment>"
read -rs NOWCODING_SMOKE_TOKEN
export NOWCODING_SMOKE_TOKEN
read -rs NOWCODING_DEPLOY_DATABASE_URL
export NOWCODING_DEPLOY_DATABASE_URL
```

Expected: shell variables are set. Do not echo the token or database URL.

- [ ] **Step 3: Push the self-host schema**

Run:

```bash
DATABASE_URL="$NOWCODING_DEPLOY_DATABASE_URL" pnpm db:push
```

Expected: Drizzle schema push completes without errors.

- [ ] **Step 4: Run public-only smoke before data seed**

Run:

```bash
NOWCODING_SMOKE_BASE_URL="$NOWCODING_RC_BASE_URL" NOWCODING_SMOKE_PUBLIC_ONLY=true pnpm smoke
```

Expected: `/`, `/card.svg`, `/badge/*`, `/og/profile.png`, `/api/stats`, `/api/now`, and `/api/heatmap` return the expected content types; `/api/usage/settings` rejects unauthenticated requests with 401 or 403.

- [ ] **Step 5: Seed controlled data and run full smoke**

Run:

```bash
NOWCODING_SMOKE_BASE_URL="$NOWCODING_RC_BASE_URL" NOWCODING_SMOKE_TOKEN="$NOWCODING_SMOKE_TOKEN" pnpm smoke:seed
NOWCODING_SMOKE_BASE_URL="$NOWCODING_RC_BASE_URL" NOWCODING_SMOKE_TOKEN="$NOWCODING_SMOKE_TOKEN" NOWCODING_SMOKE_EXPECT_DATA=true pnpm smoke
```

Expected:

```text
Seeded <origin>: ... buckets, ... sessions, 1 heartbeat
ok /api/stats data
ok /api/now data
ok /api/heatmap data
```

- [ ] **Step 6: Verify npm CLI against self-host**

Run:

```bash
npx nowcoding@next init --endpoint "$NOWCODING_RC_BASE_URL"
npx nowcoding@next heartbeat --source release-smoke --model gpt-5.5 --project nowcoding
```

Expected: `init` saves local config after hidden token prompt, and `heartbeat` returns successfully.

- [ ] **Step 7: Record self-host verification**

Append a dated entry to `docs/release-candidate.md` under `Final Report` with:

```md
## Verification Log

### 2026-05-18

- Self-host deployment URL: `<NOWCODING_RC_BASE_URL>`.
- Schema push: passed.
- Public smoke: passed.
- Full smoke with seeded data: passed.
- npm CLI `nowcoding@next` init and heartbeat: passed.
```

Run:

```bash
git add docs/release-candidate.md
git commit -m "docs: record self-host release smoke"
```

Expected: commit succeeds.

---

### Task 5: Implement Cloud Implicit Device Binding

**Files:**
- Modify: `/Users/peng/Documents/Project/nowcoding-cloud/packages/cloud-core/src/auth.ts`
- Modify: `/Users/peng/Documents/Project/nowcoding-cloud/packages/cloud-core/tests/auth.test.ts`
- Modify: `/Users/peng/Documents/Project/nowcoding-cloud/apps/cloud/app/api/auth/cli/start/route.ts`
- Modify: `/Users/peng/Documents/Project/nowcoding-cloud/apps/cloud/app/api/auth/github/callback/route.ts`
- Modify: `/Users/peng/Documents/Project/nowcoding-cloud/apps/cloud/app/api/auth/_shared.ts`
- Modify: `/Users/peng/Documents/Project/nowcoding-cloud/apps/cloud/app/login/device/page.tsx`
- Create: `/Users/peng/Documents/Project/nowcoding-cloud/apps/cloud/tests/cli-auth-implicit.test.ts`
- Modify: `/Users/peng/Documents/Project/NowCoding/apps/cli/src/commands/login.ts`
- Modify: `/Users/peng/Documents/Project/NowCoding/apps/cli/tests/login.test.ts`

- [ ] **Step 1: Write failing OSS CLI login tests for no manual user code**

In `/Users/peng/Documents/Project/NowCoding/apps/cli/tests/login.test.ts`, update the first start response to omit `userCode`:

```ts
.mockResolvedValueOnce({
  verificationUrl: 'https://cloud.example.com/login/device?status=connected',
  pollToken: 'poll_123',
})
```

Remove this expectation from the same test:

```ts
expect(log).toHaveBeenCalledWith('Enter this device code: NC-ABCD-2345');
```

Add this assertion:

```ts
expect(log).toHaveBeenCalledWith(
  'Finish login in your browser. The CLI will continue automatically.',
);
```

Run:

```bash
cd /Users/peng/Documents/Project/NowCoding
pnpm -s vitest run apps/cli/tests/login.test.ts
```

Expected: FAIL because `runLogin` currently requires `userCode`.

- [ ] **Step 2: Update OSS CLI login to make `userCode` optional**

In `/Users/peng/Documents/Project/NowCoding/apps/cli/src/commands/login.ts`, change:

```ts
interface StartResponse {
  verificationUrl?: unknown;
  pollToken?: unknown;
  userCode?: unknown;
}
```

to keep `userCode` optional, then remove the hard failure:

```ts
if (typeof started.userCode !== 'string' || started.userCode.length === 0) {
  throw new Error('Login start response did not include a user code.');
}
```

Replace the current login instructions:

```ts
console.log(`Open this URL to finish login: ${started.verificationUrl}`);
console.log(`Enter this device code: ${started.userCode}`);
```

with:

```ts
console.log(`Open this URL to finish login: ${started.verificationUrl}`);
console.log('Finish login in your browser. The CLI will continue automatically.');
if (typeof started.userCode === 'string' && started.userCode.length > 0) {
  console.log(`Fallback device code: ${started.userCode}`);
}
```

Run:

```bash
cd /Users/peng/Documents/Project/NowCoding
pnpm -s vitest run apps/cli/tests/login.test.ts
```

Expected: PASS.

- [ ] **Step 3: Write failing Cloud tests for flow-token completion**

Create `/Users/peng/Documents/Project/nowcoding-cloud/apps/cloud/tests/cli-auth-implicit.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

describe("implicit CLI device binding", () => {
  it("starts CLI auth without requiring a public user code", async () => {
    const { POST } = await import("../app/api/auth/cli/start/route");
    const request = new Request("https://nowcoding.cc/api/auth/cli/start", {
      method: "POST",
      body: JSON.stringify({ deviceName: "peng-mac", joinArena: false }),
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pollToken).toMatch(/^nc_poll_[A-Za-z0-9_-]{43}$/);
    expect(body.verificationUrl).toContain("/api/auth/github/start");
    expect(body.verificationUrl).toContain("flow=");
    expect(body.userCode).toBeUndefined();
  });

  it("documents that OAuth callback performs the happy-path binding", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        "/Users/peng/Documents/Project/nowcoding-cloud/apps/cloud/app/api/auth/github/callback/route.ts",
        "utf8",
      ),
    );

    expect(source).toContain("completeCliAuthFlowByToken");
    expect(source).toContain("login/device?status=confirmed");
  });
});
```

Run:

```bash
cd /Users/peng/Documents/Project/nowcoding-cloud
pnpm -s vitest run apps/cloud/tests/cli-auth-implicit.test.ts
```

Expected: FAIL because the start route still returns `userCode` and the callback does not complete CLI flows.

- [ ] **Step 4: Add a browser flow token helper**

In `/Users/peng/Documents/Project/nowcoding-cloud/packages/cloud-core/src/auth.ts`, add:

```ts
export function createCliFlowToken(random: RandomBytes = randomBytes): string {
  return `nc_flow_${random(32).toString("base64url")}`;
}
```

In `/Users/peng/Documents/Project/nowcoding-cloud/packages/cloud-core/tests/auth.test.ts`, add:

```ts
it("creates URL-safe CLI browser flow tokens", () => {
  expect(createCliFlowToken(() => Buffer.alloc(32, 3))).toMatch(
    /^nc_flow_[A-Za-z0-9_-]{43}$/,
  );
});
```

Import `createCliFlowToken` in that test file.

Run:

```bash
cd /Users/peng/Documents/Project/nowcoding-cloud
pnpm -s vitest run packages/cloud-core/tests/auth.test.ts
```

Expected: PASS.

- [ ] **Step 5: Update Cloud start route to return a flow-token verification URL**

In `/Users/peng/Documents/Project/nowcoding-cloud/apps/cloud/app/api/auth/cli/start/route.ts`, replace `createUserCode` usage with `createCliFlowToken`:

```ts
const flowToken = createCliFlowToken();
const flowTokenHash = await hashSecret(flowToken);
```

Store `flowTokenHash` in the existing `userCodeHash` column for this release:

```ts
await getDb().insert(cliAuthFlows).values({
  pollTokenHash,
  userCodeHash: flowTokenHash,
  deviceName,
  joinArena,
  expiresAt,
});
```

Build `returnTo` with the flow token:

```ts
const returnTo = `/login/device?flow=${encodeURIComponent(flowToken)}`;
```

Return no `userCode`:

```ts
return NextResponse.json({
  verificationUrl,
  pollToken,
  expiresAt: expiresAt.toISOString(),
});
```

Run:

```bash
cd /Users/peng/Documents/Project/nowcoding-cloud
pnpm -s vitest run apps/cloud/tests/cli-auth-implicit.test.ts
```

Expected: still FAIL until callback completion is implemented.

- [ ] **Step 6: Add Cloud flow-token completion helper**

In `/Users/peng/Documents/Project/nowcoding-cloud/apps/cloud/app/api/auth/_shared.ts`, add:

```ts
export async function completeCliAuthFlowByToken(
  db: Database,
  flowToken: string,
  user: UserRecord,
): Promise<boolean> {
  const now = new Date();
  const flowTokenHash = await hashSecret(flowToken);
  const [claimedFlow] = await db
    .update(cliAuthFlows)
    .set({
      userId: user.id,
      completedAt: now,
    })
    .where(
      and(
        eq(cliAuthFlows.userCodeHash, flowTokenHash),
        gt(cliAuthFlows.expiresAt, now),
        isNull(cliAuthFlows.completedAt),
        isNull(cliAuthFlows.deviceId),
        isNull(cliAuthFlows.deviceToken),
      ),
    )
    .returning({
      pollTokenHash: cliAuthFlows.pollTokenHash,
      deviceName: cliAuthFlows.deviceName,
      joinArena: cliAuthFlows.joinArena,
    });

  if (!claimedFlow) {
    return false;
  }

  const deviceToken = createDeviceToken();
  const tokenHash = await hashSecret(deviceToken);
  const [device] = await db
    .insert(devices)
    .values({
      userId: user.id,
      name: claimedFlow.deviceName ?? "NowCoding CLI",
      tokenHash,
    })
    .returning({ id: devices.id });

  if (!device) {
    throw new Error("Unable to create CLI device");
  }

  await db
    .update(cliAuthFlows)
    .set({
      userId: user.id,
      deviceId: device.id,
      deviceToken,
    })
    .where(eq(cliAuthFlows.pollTokenHash, claimedFlow.pollTokenHash));

  if (claimedFlow.joinArena) {
    await joinArenaIfRequested(db, user.id);
  }

  return true;
}
```

Run:

```bash
cd /Users/peng/Documents/Project/nowcoding-cloud
pnpm -s vitest run apps/cloud/tests/cli-auth-implicit.test.ts
```

Expected: still FAIL until callback calls `completeCliAuthFlowByToken`.

- [ ] **Step 7: Complete CLI flow in the GitHub callback**

In `/Users/peng/Documents/Project/nowcoding-cloud/apps/cloud/app/api/auth/github/callback/route.ts`, import:

```ts
import {
  GITHUB_IDENTITY_COOKIE,
  completeCliAuthFlowByToken,
  reserveGitHubUser,
} from "../../_shared";
import { getDb } from "@nowcoding/cloud-db";
```

After `const githubUser = await fetchGitHubUser(accessToken);`, add:

```ts
const cliFlowUrl = new URL(verifiedState.returnTo || "/", getCloudUrl());
const flowToken = cliFlowUrl.searchParams.get("flow");

if (flowToken) {
  const user = await reserveGitHubUser(getDb(), {
    githubId: String(githubUser.id),
    githubLogin: githubUser.login,
    displayName: githubUser.name,
    avatarUrl: githubUser.avatar_url,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  const completed = await completeCliAuthFlowByToken(getDb(), flowToken, user);
  return redirectTo(`/login/device?status=${completed ? "confirmed" : "invalid"}`);
}
```

Keep the existing identity cookie path for non-CLI OAuth returns.

Run:

```bash
cd /Users/peng/Documents/Project/nowcoding-cloud
pnpm -s vitest run apps/cloud/tests/cli-auth-implicit.test.ts
```

Expected: PASS.

- [ ] **Step 8: Replace the happy-path device page copy**

In `/Users/peng/Documents/Project/nowcoding-cloud/apps/cloud/app/login/device/page.tsx`, remove the manual device-code form from the default view and render:

```tsx
<h1>NowCoding CLI is connected.</h1>
<p>You can close this tab and return to your terminal.</p>
```

Keep error states for `status=invalid`, `status=expired`, and `status=missing-session` if they already exist.

Run:

```bash
cd /Users/peng/Documents/Project/nowcoding-cloud
pnpm -s vitest run apps/cloud/tests/cli-auth-implicit.test.ts apps/cloud/tests/cli-auth-confirmation.test.ts
```

Expected: PASS. Existing manual confirmation tests may remain as fallback coverage until the route is removed in a later cleanup commit.

- [ ] **Step 9: Run cross-repo login tests**

Run:

```bash
cd /Users/peng/Documents/Project/NowCoding
pnpm -s vitest run apps/cli/tests/login.test.ts apps/cli/tests/config.test.ts apps/cli/tests/api.test.ts

cd /Users/peng/Documents/Project/nowcoding-cloud
pnpm -s vitest run packages/cloud-core/tests/auth.test.ts apps/cloud/tests/cli-auth-implicit.test.ts apps/cloud/tests/cli-auth-confirmation.test.ts
```

Expected: all listed tests pass.

- [ ] **Step 10: Commit both repos**

Run in the OSS repo:

```bash
cd /Users/peng/Documents/Project/NowCoding
git add apps/cli/src/commands/login.ts apps/cli/tests/login.test.ts
git commit -m "feat: support implicit cloud device login"
```

Run in the Cloud repo:

```bash
cd /Users/peng/Documents/Project/nowcoding-cloud
git add packages/cloud-core/src/auth.ts packages/cloud-core/tests/auth.test.ts apps/cloud/app/api/auth/cli/start/route.ts apps/cloud/app/api/auth/github/callback/route.ts apps/cloud/app/api/auth/_shared.ts apps/cloud/app/login/device/page.tsx apps/cloud/tests/cli-auth-implicit.test.ts apps/cloud/tests/cli-auth-confirmation.test.ts
git commit -m "feat: bind cli devices after github oauth"
```

Expected: both commits succeed.

---

### Task 6: Harden Cloud Production Smoke

**Files:**
- Modify: `/Users/peng/Documents/Project/nowcoding-cloud/scripts/cloud-smoke.mjs`
- Modify: `/Users/peng/Documents/Project/nowcoding-cloud/scripts/cloud-smoke.test.ts`
- Modify: `/Users/peng/Documents/Project/nowcoding-cloud/docs/deploy.md`
- Modify: `/Users/peng/Documents/Project/nowcoding-cloud/README.md`

- [ ] **Step 1: Update smoke target tests**

In `/Users/peng/Documents/Project/nowcoding-cloud/scripts/cloud-smoke.test.ts`, update the `builds core smoke targets` expectation to:

```ts
expect(
  buildSmokeTargets("https://nowcoding.cc", "tianpeng-dev").map((target) => target.path),
).toEqual([
  "/",
  "/leaderboard",
  "/api/leaderboard?range=30d&scope=all&metric=tokens",
  "/u/tianpeng-dev",
  "/u/tianpeng-dev/card.svg",
  "/u/tianpeng-dev/badge/today.svg",
  "/api/u/tianpeng-dev/stats?period=7d",
  "/api/u/tianpeng-dev/now",
]);
```

Add matching fake responses to `defaultResponses`:

```ts
"https://nowcoding.cc/u/tianpeng-dev": new Response("<html></html>", {
  status: 200,
  headers: { "content-type": "text/html; charset=utf-8" },
}),
"https://nowcoding.cc/u/tianpeng-dev/card.svg": new Response("<svg></svg>", {
  status: 200,
  headers: { "content-type": "image/svg+xml" },
}),
"https://nowcoding.cc/u/tianpeng-dev/badge/today.svg": new Response("<svg></svg>", {
  status: 200,
  headers: { "content-type": "image/svg+xml" },
}),
"https://nowcoding.cc/api/u/tianpeng-dev/stats?period=7d": jsonResponse(200),
"https://nowcoding.cc/api/u/tianpeng-dev/now": jsonResponse(200),
```

Run:

```bash
cd /Users/peng/Documents/Project/nowcoding-cloud
pnpm -s vitest run scripts/cloud-smoke.test.ts
```

Expected: FAIL because `buildSmokeTargets` does not include the new targets.

- [ ] **Step 2: Update Cloud smoke targets**

In `/Users/peng/Documents/Project/nowcoding-cloud/scripts/cloud-smoke.mjs`, change `buildSmokeTargets` to return:

```js
return [
  { path: "/", expectedStatus: 200, expectedContentType: "text/html" },
  { path: "/leaderboard", expectedStatus: 200, expectedContentType: "text/html" },
  {
    path: "/api/leaderboard?range=30d&scope=all&metric=tokens",
    expectedStatus: 200,
    expectedContentType: "application/json",
  },
  {
    path: `/u/${encodeURIComponent(username)}`,
    expectedStatus: 200,
    expectedContentType: "text/html",
    optionalStatuses: [404],
    optionalReason: "profile data may not exist yet",
  },
  {
    path: `/u/${encodeURIComponent(username)}/card.svg`,
    expectedStatus: 200,
    expectedContentType: "image/svg+xml",
    optionalStatuses: [404],
    optionalReason: "profile data may not exist yet",
  },
  {
    path: `/u/${encodeURIComponent(username)}/badge/today.svg`,
    expectedStatus: 200,
    expectedContentType: "image/svg+xml",
    optionalStatuses: [404],
    optionalReason: "profile data may not exist yet",
  },
  {
    path: `/api/u/${encodeURIComponent(username)}/stats?period=7d`,
    expectedStatus: 200,
    expectedContentType: "application/json",
    optionalStatuses: [404],
    optionalReason: "profile data may not exist yet",
  },
  {
    path: `/api/u/${encodeURIComponent(username)}/now`,
    expectedStatus: 200,
    expectedContentType: "application/json",
    optionalStatuses: [404],
    optionalReason: "profile data may not exist yet",
  },
];
```

Run:

```bash
cd /Users/peng/Documents/Project/nowcoding-cloud
pnpm -s vitest run scripts/cloud-smoke.test.ts
```

Expected: PASS.

- [ ] **Step 3: Document username-aware smoke**

In `/Users/peng/Documents/Project/nowcoding-cloud/docs/deploy.md`, replace the smoke command:

```bash
pnpm smoke https://nowcoding.cc
```

with:

```bash
NOWCODING_SMOKE_USERNAME=tianpeng-dev pnpm smoke https://nowcoding.cc
```

In `/Users/peng/Documents/Project/nowcoding-cloud/README.md`, add this to the launch verification commands:

```bash
NOWCODING_SMOKE_USERNAME=tianpeng-dev pnpm smoke https://nowcoding.cc
```

- [ ] **Step 4: Run Cloud checks**

Run:

```bash
cd /Users/peng/Documents/Project/nowcoding-cloud
pnpm lint
pnpm typecheck
pnpm test
pnpm build
NOWCODING_SMOKE_USERNAME=tianpeng-dev pnpm smoke https://nowcoding.cc
```

Expected: all commands pass. Smoke may log optional 404 skips only if the user has no profile data; for production readiness with seeded data, `/u/tianpeng-dev`, card, badge, stats, and now should all return 200.

- [ ] **Step 5: Commit Cloud smoke hardening**

Run:

```bash
cd /Users/peng/Documents/Project/nowcoding-cloud
git add scripts/cloud-smoke.mjs scripts/cloud-smoke.test.ts docs/deploy.md README.md
git commit -m "test: expand cloud production smoke"
```

Expected: commit succeeds.

---

### Task 7: End-to-End Production Gate

**Files:**
- Read: `/Users/peng/Documents/Project/NowCoding/docs/release-candidate.md`
- Read: `/Users/peng/Documents/Project/nowcoding-cloud/docs/deployment-checklists/production-readiness.md`
- Modify: `/Users/peng/Documents/Project/nowcoding-cloud/docs/deploy.md`
- Modify: `/Users/peng/Documents/Project/NowCoding/CHANGELOG.md`

- [ ] **Step 1: Deploy OSS and Cloud latest commits**

Deploy:

```text
OSS self-host test deployment from tianpeng-dev/nowcoding
Cloud production deployment from tianpeng-dev/nowcoding-cloud
```

Expected: Vercel shows successful production deployment for Cloud and successful self-host deployment for the RC URL.

- [ ] **Step 2: Verify Cloud login with real npm CLI**

Run:

```bash
npx nowcoding@next login
```

Expected:

```text
Open this URL to finish login: https://nowcoding.cc/...
Finish login in your browser. The CLI will continue automatically.
Logged in to NowCoding Cloud as tianpeng-dev.
```

Confirm `~/.nowcoding/config.json` contains:

```json
{
  "mode": "cloud",
  "endpoint": "https://nowcoding.cc",
  "apiToken": "nc_dev_...",
  "cloud": {
    "username": "tianpeng-dev",
    "deviceId": "...",
    "arenaJoined": true
  }
}
```

- [ ] **Step 3: Upload real usage and heartbeat to Cloud**

Run:

```bash
npx nowcoding@next sync --strict
npx nowcoding@next heartbeat --source codex --model gpt-5.5 --project nowcoding
```

Expected: both commands complete without errors.

- [ ] **Step 4: Verify public Cloud surfaces**

Run:

```bash
curl -fsS https://nowcoding.cc/u/tianpeng-dev >/dev/null
curl -fsS https://nowcoding.cc/u/tianpeng-dev/card.svg >/dev/null
curl -fsS https://nowcoding.cc/u/tianpeng-dev/badge/today.svg >/dev/null
curl -fsS https://nowcoding.cc/api/u/tianpeng-dev/stats?period=7d >/dev/null
curl -fsS https://nowcoding.cc/api/u/tianpeng-dev/now >/dev/null
NOWCODING_SMOKE_USERNAME=tianpeng-dev pnpm --dir /Users/peng/Documents/Project/nowcoding-cloud smoke https://nowcoding.cc
```

Expected: all `curl` commands exit 0 and Cloud smoke passes.

- [ ] **Step 5: Verify self-host surfaces**

Run:

```bash
NOWCODING_SMOKE_BASE_URL="$NOWCODING_RC_BASE_URL" NOWCODING_SMOKE_PUBLIC_ONLY=true pnpm smoke
NOWCODING_SMOKE_BASE_URL="$NOWCODING_RC_BASE_URL" NOWCODING_SMOKE_TOKEN="$NOWCODING_SMOKE_TOKEN" NOWCODING_SMOKE_EXPECT_DATA=true pnpm smoke
```

Expected: both self-host smoke commands pass.

- [ ] **Step 6: Record the production gate**

In `/Users/peng/Documents/Project/nowcoding-cloud/docs/deploy.md`, append:

```md
### 2026-05-18 Main Chain Gate

- `npx nowcoding@next login` completed through GitHub OAuth without a second manual device confirmation step.
- CLI device token saved locally with `mode: cloud`.
- Cloud sync and heartbeat succeeded.
- Cloud profile, card, badge, stats, now, and smoke passed for `tianpeng-dev`.
```

In `/Users/peng/Documents/Project/NowCoding/CHANGELOG.md`, append:

```md
- Verified main chain release readiness across npm CLI, self-host smoke, and Cloud profile/card/badge smoke.
```

Run:

```bash
cd /Users/peng/Documents/Project/nowcoding-cloud
git add docs/deploy.md
git commit -m "docs: record main chain production gate"

cd /Users/peng/Documents/Project/NowCoding
git add CHANGELOG.md
git commit -m "docs: record main chain release gate"
```

Expected: both commits succeed.

---

## Self-Review

- Spec coverage: the plan covers the agreed repo boundary, npm placeholder state, `nowcoding.cc` username-scoped Cloud surfaces, implicit Cloud device binding, self-host verification, and v1.5 macOS helper deferral.
- Placeholder scan: the plan avoids open-ended implementation steps; every code-changing step names files and concrete code or commands.
- Type consistency: `0.1.0-alpha.1`, `nowcoding-cli/0.1.0-alpha.1`, `nc_dev_`, `nc_poll_`, and the new `nc_flow_` token prefix are used consistently.
- Supabase safety: the plan keeps Cloud writes behind server routes, preserves RLS expectations, and does not expose service-role credentials to CLI or browser code.
