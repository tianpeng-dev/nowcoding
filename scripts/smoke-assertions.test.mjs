import { describe, expect, test } from 'vitest';

import { assertExpectedData } from './smoke-assertions.mjs';

describe('assertExpectedData', () => {
  test('accepts seeded stats data', () => {
    expect(() =>
      assertExpectedData('/api/stats', {
        totalTokens: 42,
        topModel: { name: 'gpt-5.5' },
        topSource: { name: 'codex' },
      }),
    ).not.toThrow();
  });

  test('accepts seeded now data', () => {
    expect(() =>
      assertExpectedData('/api/now', {
        todayTokens: 42,
        currentSource: 'codex',
        status: 'live',
      }),
    ).not.toThrow();
  });

  test('accepts seeded heatmap data', () => {
    expect(() =>
      assertExpectedData('/api/heatmap', {
        cells: [{ tokens: 0 }, { tokens: 42 }],
      }),
    ).not.toThrow();
  });

  test.each([
    [
      '/api/stats',
      { totalTokens: 0, topModel: { name: 'gpt-5.5' }, topSource: { name: 'codex' } },
      '/api/stats totalTokens must be greater than 0',
    ],
    [
      '/api/stats',
      { totalTokens: 42, topModel: {}, topSource: { name: 'codex' } },
      '/api/stats topModel.name must be present',
    ],
    [
      '/api/stats',
      { totalTokens: 42, topModel: { name: 'gpt-5.5' }, topSource: {} },
      '/api/stats topSource.name must be present',
    ],
    [
      '/api/now',
      { todayTokens: 0, currentSource: 'codex', status: 'live' },
      '/api/now todayTokens must be greater than 0',
    ],
    ['/api/now', { todayTokens: 42, status: 'live' }, '/api/now currentSource must be present'],
    [
      '/api/now',
      { todayTokens: 42, currentSource: 'codex' },
      '/api/now status must be active, got undefined',
    ],
    [
      '/api/now',
      { todayTokens: 42, currentSource: 'codex', status: 'active' },
      '/api/now status must be active, got active',
    ],
    [
      '/api/now',
      { todayTokens: 42, currentSource: 'codex', status: 'inactive' },
      '/api/now status must be active, got inactive',
    ],
    [
      '/api/now',
      { todayTokens: 42, currentSource: 'codex', status: 'private' },
      '/api/now status must be active, got private',
    ],
    ['/api/heatmap', { cells: null }, '/api/heatmap cells must be an array'],
    [
      '/api/heatmap',
      { cells: [{ tokens: 0 }, { tokens: null }] },
      '/api/heatmap must include at least one active cell',
    ],
  ])('rejects empty data for %s with exact message', (path, json, message) => {
    expect(() => assertExpectedData(path, json)).toThrow(message);
  });

  test.each([
    ['/api/stats', null, '/api/stats response must be a JSON object'],
    ['/api/now', [], '/api/now response must be a JSON object'],
    ['/api/heatmap', 'nope', '/api/heatmap response must be a JSON object'],
  ])('rejects non-object data for %s with exact message', (path, json, message) => {
    expect(() => assertExpectedData(path, json)).toThrow(message);
  });

  test('ignores non-data routes', () => {
    expect(() => assertExpectedData('/api/usage/settings', null)).not.toThrow();
    expect(() => assertExpectedData('/', 'html')).not.toThrow();
  });
});
