import { timingSafeEqual } from 'node:crypto';

// P0-6: Token compare must be timing-safe to prevent enumeration via response
// time. `===` short-circuits on the first mismatched byte.
export function verifyBearer(authHeader: string | null, expected: string | undefined): boolean {
  if (!expected || !authHeader) return false;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!m) return false;
  const provided = m[1] ?? '';
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
