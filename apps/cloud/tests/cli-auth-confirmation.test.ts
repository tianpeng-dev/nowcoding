import { describe, expect, test } from 'vitest';
import { getCliAuthConfirmation } from '../app/api/auth/cli/confirm/_confirmation';

describe('getCliAuthConfirmation', () => {
  test('reads a checked Arena consent checkbox from browser form data', async () => {
    const form = new FormData();
    form.set('userCode', 'NC-ABCD-2345');
    form.set('joinArena', 'true');

    const request = new Request('https://nowcoding.cc/api/auth/cli/confirm', {
      method: 'POST',
      body: form,
    });

    await expect(getCliAuthConfirmation(request)).resolves.toEqual({
      userCode: 'NC-ABCD-2345',
      joinArena: true,
    });
  });

  test('treats a missing Arena consent form field as unchecked', async () => {
    const form = new FormData();
    form.set('userCode', 'NC-ABCD-2345');

    const request = new Request('https://nowcoding.cc/api/auth/cli/confirm', {
      method: 'POST',
      body: form,
    });

    await expect(getCliAuthConfirmation(request)).resolves.toEqual({
      userCode: 'NC-ABCD-2345',
      joinArena: false,
    });
  });

  test('requires explicit true Arena consent in JSON requests', async () => {
    const request = new Request('https://nowcoding.cc/api/auth/cli/confirm', {
      method: 'POST',
      body: JSON.stringify({ userCode: 'NC-ABCD-2345' }),
      headers: { 'content-type': 'application/json' },
    });

    await expect(getCliAuthConfirmation(request)).resolves.toEqual({
      userCode: 'NC-ABCD-2345',
      joinArena: false,
    });
  });

  test('accepts explicit true Arena consent in JSON requests', async () => {
    const request = new Request('https://nowcoding.cc/api/auth/cli/confirm', {
      method: 'POST',
      body: JSON.stringify({ userCode: 'NC-ABCD-2345', joinArena: true }),
      headers: { 'content-type': 'application/json' },
    });

    await expect(getCliAuthConfirmation(request)).resolves.toEqual({
      userCode: 'NC-ABCD-2345',
      joinArena: true,
    });
  });
});
