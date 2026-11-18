import {
  isAdminGithubLogin,
  isUuid,
  parsePostgresBigintId,
  verifyGitHubIdentitySession,
} from '@nowcoding/cloud-core';
import { getDb, leaderboardEntries, users } from '@nowcoding/cloud-db';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { GITHUB_IDENTITY_COOKIE } from '../api/auth/_shared';
import CloudNav from '../components/cloud-nav';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function isAuthorizedAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const identity = verifyGitHubIdentitySession(
    cookieStore.get(GITHUB_IDENTITY_COOKIE)?.value ?? '',
  );

  return Boolean(
    identity && isAdminGithubLogin(identity.githubLogin, process.env.ADMIN_GITHUB_LOGINS ?? ''),
  );
}

async function requireAdmin(): Promise<void> {
  if (!(await isAuthorizedAdmin())) {
    throw new Error('admin_forbidden');
  }
}

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === 'string' ? value.trim() : '';
}

async function hideUser(formData: FormData): Promise<void> {
  'use server';

  await requireAdmin();

  const id = formString(formData, 'id');

  if (isUuid(id)) {
    await getDb()
      .update(users)
      .set({ hiddenAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  redirect('/admin');
}

async function excludeLeaderboardEntry(formData: FormData): Promise<void> {
  'use server';

  await requireAdmin();

  const id = formString(formData, 'id');
  const entryId = parsePostgresBigintId(id);

  if (entryId !== null) {
    await getDb()
      .update(leaderboardEntries)
      .set({ excludedAt: new Date() })
      .where(eq(leaderboardEntries.id, entryId));
  }

  redirect('/admin');
}

async function viewIngestSummary(formData: FormData): Promise<void> {
  'use server';

  await requireAdmin();

  const id = formString(formData, 'id');

  if (isUuid(id)) {
    redirect(`/api/admin/ingest/${encodeURIComponent(id)}`);
  }

  redirect('/admin');
}

export default async function AdminPage() {
  if (!(await isAuthorizedAdmin())) {
    return (
      <main className="shell admin-layout">
        <CloudNav active="account" note="Admin operations" signInReturnTo="/admin" />
        <section className="admin-card">
          <p className="eyebrow">Admin</p>
          <h1>Admin access required.</h1>
          <p className="lead">GitHub admin access required.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell admin-layout">
      <CloudNav active="account" note="Admin operations" signInReturnTo="/admin" />

      <header className="page-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Control plane.</h1>
          <p className="lead">
            Review public visibility, Arena eligibility, and recent ingest evidence without changing
            user-facing API contracts.
          </p>
        </div>
      </header>

      <section className="admin-grid">
        <form action={hideUser} className="admin-form">
          <h2>Hide user</h2>
          <label htmlFor="hide-user-id">User ID</label>
          <input id="hide-user-id" name="id" required />
          <button type="submit">Hide user</button>
        </form>

        <form action={excludeLeaderboardEntry} className="admin-form">
          <h2>Exclude leaderboard entry</h2>
          <label htmlFor="leaderboard-entry-id">Leaderboard entry ID</label>
          <input id="leaderboard-entry-id" name="id" required />
          <button type="submit">Exclude entry</button>
        </form>

        <form action={viewIngestSummary} className="admin-form">
          <h2>View recent ingest summary</h2>
          <label htmlFor="ingest-user-id">User ID</label>
          <input id="ingest-user-id" name="id" required />
          <button type="submit">View summary</button>
        </form>
      </section>
    </main>
  );
}
