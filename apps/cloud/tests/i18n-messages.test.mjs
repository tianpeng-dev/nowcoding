import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const en = readJson('../messages/en.json');
const zhCN = readJson('../messages/zh-CN.json');

const flattenKeys = (value, prefix = '') => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
};

const collectStrings = (value, prefix = '') => {
  if (typeof value === 'string') {
    return [{ key: prefix, value }];
  }

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    collectStrings(child, prefix ? `${prefix}.${key}` : key),
  );
};

test('localized cloud message files expose the same keys', () => {
  expect(flattenKeys(zhCN).sort()).toEqual(flattenKeys(en).sort());
});

test('Simplified Chinese UI copy does not expose Arena as an untranslated label', () => {
  const allowedArenaKeys = new Set(['common.brand', 'home.title']);
  const leakedArenaStrings = collectStrings(zhCN).filter(
    ({ key, value }) => !allowedArenaKeys.has(key) && /\bArena\b/.test(value),
  );

  expect(leakedArenaStrings).toEqual([]);
});
