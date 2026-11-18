import {
  type GitHubIdentitySession,
  createDeviceToken,
  hashSecret,
  normalizeUserCode,
} from '@nowcoding/cloud-core';
import { type Database, cliAuthFlows, devices, users } from '@nowcoding/cloud-db';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { joinArenaForUser } from '../../../lib/arena-consent';

export const GITHUB_IDENTITY_COOKIE = 'nc_github_identity';
export const CLI_STATUS_COOKIE = 'nc_cli_status';

type UserRecord = typeof users.$inferSelect;
type ClaimedCliAuthFlow = {
  pollTokenHash: string;
  deviceName: string | null;
  joinArena: boolean | null;
};

function getUniqueViolationConstraint(error: unknown): string | null {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    (error as { code?: unknown }).code !== '23505'
  ) {
    return null;
  }

  const constraint = (error as { constraint?: unknown }).constraint;

  if (typeof constraint === 'string') {
    return constraint;
  }

  const message = (error as { message?: unknown }).message;

  if (typeof message === 'string') {
    return message;
  }

  return 'unknown_unique_constraint';
}

function isUsernameUniqueViolation(error: unknown): boolean {
  const constraint = getUniqueViolationConstraint(error);

  return (
    constraint !== null && (constraint.includes('username') || constraint.includes('(username)'))
  );
}

function isGitHubIdUniqueViolation(error: unknown): boolean {
  const constraint = getUniqueViolationConstraint(error);

  return (
    constraint !== null && (constraint.includes('github_id') || constraint.includes('(github_id)'))
  );
}

function isGitHubLoginUniqueViolation(error: unknown): boolean {
  const constraint = getUniqueViolationConstraint(error);

  return (
    constraint !== null &&
    (constraint.includes('github_login') || constraint.includes('(github_login)'))
  );
}

function usernameFromGitHubLogin(login: string): string {
  const username = login
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return username || 'github-user';
}

export async function reserveGitHubUser(
  db: Database,
  identity: GitHubIdentitySession,
): Promise<UserRecord> {
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.githubId, identity.githubId))
    .limit(1);

  if (existingUser) {
    try {
      const [updatedUser] = await db
        .update(users)
        .set({
          githubLogin: identity.githubLogin,
          displayName: identity.displayName,
          avatarUrl: identity.avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning();

      return updatedUser ?? existingUser;
    } catch (error) {
      if (isGitHubLoginUniqueViolation(error)) {
        throw new Error('GitHub login is already linked to another user');
      }

      throw error;
    }
  }

  const baseUsername = usernameFromGitHubLogin(identity.githubLogin);

  for (let index = 1; index <= 50; index += 1) {
    const username = index === 1 ? baseUsername : `${baseUsername}-${index}`;
    const [usernameOwner] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (usernameOwner) {
      continue;
    }

    try {
      const [createdUser] = await db
        .insert(users)
        .values({
          username,
          githubId: identity.githubId,
          githubLogin: identity.githubLogin,
          displayName: identity.displayName,
          avatarUrl: identity.avatarUrl,
        })
        .returning();

      if (createdUser) {
        return createdUser;
      }
    } catch (error) {
      if (isUsernameUniqueViolation(error)) {
        continue;
      }

      if (isGitHubIdUniqueViolation(error)) {
        const [racedUser] = await db
          .select()
          .from(users)
          .where(eq(users.githubId, identity.githubId))
          .limit(1);

        if (racedUser) {
          return racedUser;
        }
      }

      if (isGitHubLoginUniqueViolation(error)) {
        throw new Error('GitHub login is already linked to another user');
      }

      throw error;
    }
  }

  throw new Error('Unable to reserve username');
}

async function completeClaimedCliAuthFlow(
  db: Database,
  claimedFlow: ClaimedCliAuthFlow,
  user: UserRecord,
  joinArena: boolean,
): Promise<boolean> {
  const deviceToken = createDeviceToken();
  const tokenHash = await hashSecret(deviceToken);
  const [device] = await db
    .insert(devices)
    .values({
      userId: user.id,
      name: claimedFlow.deviceName ?? 'NowCoding CLI',
      tokenHash,
    })
    .returning({ id: devices.id });

  if (!device) {
    throw new Error('Unable to create CLI device');
  }

  await db
    .update(cliAuthFlows)
    .set({
      userId: user.id,
      deviceId: device.id,
      deviceToken,
    })
    .where(eq(cliAuthFlows.pollTokenHash, claimedFlow.pollTokenHash));

  if (joinArena) {
    await joinArenaForUser(db, user.id);
  }

  return true;
}

export async function confirmCliAuthFlow(
  db: Database,
  userCode: string,
  user: UserRecord,
  joinArena: boolean,
): Promise<boolean> {
  const normalizedUserCode = normalizeUserCode(userCode);

  if (!normalizedUserCode) {
    return false;
  }

  const now = new Date();
  const userCodeHash = await hashSecret(normalizedUserCode);
  const [claimedFlow] = await db
    .update(cliAuthFlows)
    .set({
      userId: user.id,
      completedAt: now,
      joinArena,
    })
    .where(
      and(
        eq(cliAuthFlows.userCodeHash, userCodeHash),
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

  return completeClaimedCliAuthFlow(db, claimedFlow, user, joinArena);
}

export async function completeCliAuthFlowByToken(
  db: Database,
  flowToken: string,
  user: UserRecord,
  status?: { statusNonce?: string },
): Promise<boolean> {
  if (!flowToken.startsWith('nc_flow_')) {
    return false;
  }

  const now = new Date();
  const flowTokenHash = await hashSecret(flowToken);
  const statusNonceHash = status?.statusNonce ? await hashSecret(status.statusNonce) : null;
  const [claimedFlow] = await db
    .update(cliAuthFlows)
    .set({
      userId: user.id,
      completedAt: now,
      statusNonceHash,
      statusExpiresAt: new Date(now.getTime() + 10 * 60 * 1000),
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
    });

  if (!claimedFlow) {
    return false;
  }

  return true;
}
