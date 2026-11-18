'use server';

import { getDb } from '@nowcoding/cloud-db';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { joinArenaForUser, leaveArenaForUser } from '../../lib/arena-consent';
import { GITHUB_IDENTITY_COOKIE, getCurrentBrowserUserFromCookie } from '../../lib/browser-session';

async function requireCurrentBrowserUser() {
  const cookieStore = await cookies();
  const currentUser = await getCurrentBrowserUserFromCookie(
    cookieStore.get(GITHUB_IDENTITY_COOKIE)?.value,
  );

  if (!currentUser) {
    redirect('/onboarding?status=sign-in-required');
  }

  return currentUser;
}

export async function joinArenaFromOnboarding(): Promise<void> {
  const currentUser = await requireCurrentBrowserUser();

  await joinArenaForUser(getDb(), currentUser.user.id);
  revalidatePath('/onboarding');
  redirect('/onboarding?status=arena-joined');
}

export async function leaveArenaFromOnboarding(): Promise<void> {
  const currentUser = await requireCurrentBrowserUser();

  await leaveArenaForUser(getDb(), currentUser.user.id);
  revalidatePath('/onboarding');
  redirect('/onboarding?status=arena-left');
}
