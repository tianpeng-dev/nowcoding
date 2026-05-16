import { PassThrough, Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { askHidden } from '../src/lib/prompt';

describe('hidden prompts', () => {
  it('returns entered text without writing it to output', async () => {
    const input = new PassThrough();
    const writes: string[] = [];
    const output = new Writable({
      write(chunk, _encoding, callback) {
        writes.push(String(chunk));
        callback();
      },
    });

    const answer = askHidden('API token', input, output);
    input.end('super-secret-token\n');

    await expect(answer).resolves.toBe('super-secret-token');
    expect(writes.join('')).toContain('API token');
    expect(writes.join('')).not.toContain('super-secret-token');
  });
});
