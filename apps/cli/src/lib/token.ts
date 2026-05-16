import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import { isApiToken } from '@nowcoding/core/token';

type RandomBytes = (size: number) => Uint8Array;

export function generateApiToken(random: RandomBytes = randomBytes): string {
  return `nc_live_${Buffer.from(random(24)).toString('base64url')}`;
}

export { isApiToken };
