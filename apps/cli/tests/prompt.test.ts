import { PassThrough, Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { askHidden, askYesNo } from '../src/lib/prompt';

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

describe('yes/no prompts', () => {
  it('renders yes as the default and returns true for enter', async () => {
    const input = new PassThrough();
    const writes: string[] = [];
    const output = new Writable({
      write(chunk, _encoding, callback) {
        writes.push(String(chunk));
        callback();
      },
    });

    const answer = askYesNo('Enable automatic background sync?', false, input, output);
    input.end('\n');

    await expect(answer).resolves.toBe(true);
    expect(writes.join('')).toBe('Enable automatic background sync? [Y/n]:');
  });

  it('renders no as the default and returns false for enter', async () => {
    const input = new PassThrough();
    const writes: string[] = [];
    const output = new Writable({
      write(chunk, _encoding, callback) {
        writes.push(String(chunk));
        callback();
      },
    });

    const answer = askYesNo('Join Arena?', true, input, output);
    input.end('\n');

    await expect(answer).resolves.toBe(false);
    expect(writes.join('')).toBe('Join Arena? [y/N]:');
  });
});
