import { createHmac } from 'node:crypto';
import { type Database, accountSecurityEvents, getDb } from '@nowcoding/cloud-db';

export type AccountSecurityEventType =
  | 'github_sign_in'
  | 'cli_flow_confirmed'
  | 'device_token_claimed'
  | 'device_renamed'
  | 'device_revoked'
  | 'arena_joined'
  | 'arena_left';

function getAccountSecurityEventSecret(): string | null {
  return (
    process.env.ACCOUNT_SECURITY_EVENT_SECRET ||
    process.env.GITHUB_OAUTH_STATE_SECRET ||
    process.env.GITHUB_CLIENT_SECRET ||
    process.env.SESSION_SECRET ||
    null
  );
}

function hmacIpAddress(rawIpAddress: string, secret: string): string {
  return createHmac('sha256', secret).update(`ip:${rawIpAddress}`).digest('hex');
}

export async function ipHashFromHeaders(headers: Headers): Promise<string | null> {
  const raw =
    headers.get('cf-connecting-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null;

  const secret = getAccountSecurityEventSecret();

  return raw && secret ? hmacIpAddress(raw, secret) : null;
}

export async function writeAccountSecurityEvent(
  input: {
    userId: string;
    eventType: AccountSecurityEventType;
    deviceId?: string | null;
    metadata?: Record<string, unknown>;
    ipHash?: string | null;
  },
  db: Pick<Database, 'insert'> = getDb(),
): Promise<void> {
  await db.insert(accountSecurityEvents).values({
    userId: input.userId,
    deviceId: input.deviceId ?? null,
    eventType: input.eventType,
    metadata: input.metadata ?? {},
    ipHash: input.ipHash ?? null,
  });
}
