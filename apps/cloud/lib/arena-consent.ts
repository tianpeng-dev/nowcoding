import { type Database, arenaConsents } from '@nowcoding/cloud-db';
import { eq } from 'drizzle-orm';

export type ArenaConsentState = {
  joined: boolean;
  acceptedAt: Date | null;
  updatedAt: Date | null;
};

export async function joinArenaForUser(
  db: Pick<Database, 'insert'>,
  userId: string,
): Promise<void> {
  const now = new Date();

  await db
    .insert(arenaConsents)
    .values({
      userId,
      joined: true,
      acceptedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: arenaConsents.userId,
      set: {
        joined: true,
        acceptedAt: now,
        updatedAt: now,
      },
    });
}

export async function leaveArenaForUser(
  db: Pick<Database, 'insert'>,
  userId: string,
): Promise<void> {
  const now = new Date();

  await db
    .insert(arenaConsents)
    .values({
      userId,
      joined: false,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: arenaConsents.userId,
      set: {
        joined: false,
        updatedAt: now,
      },
    });
}

export async function readArenaConsentForUser(
  db: Pick<Database, 'select'>,
  userId: string,
): Promise<ArenaConsentState> {
  const [row] = await db
    .select({
      joined: arenaConsents.joined,
      acceptedAt: arenaConsents.acceptedAt,
      updatedAt: arenaConsents.updatedAt,
    })
    .from(arenaConsents)
    .where(eq(arenaConsents.userId, userId))
    .limit(1);

  return {
    joined: row?.joined === true,
    acceptedAt: row?.acceptedAt ?? null,
    updatedAt: row?.updatedAt ?? null,
  };
}
