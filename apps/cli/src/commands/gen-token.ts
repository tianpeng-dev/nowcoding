import { generateApiToken } from '../lib/token.js';

type RandomBytes = Parameters<typeof generateApiToken>[0];

export function runGenToken(random?: RandomBytes): void {
  console.log(generateApiToken(random));
}
