import { describe, expect, it } from 'vitest';
import en from '../messages/en.json';
import zhCN from '../messages/zh-CN.json';

const flattenKeys = (value: unknown, prefix = ''): string[] => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
};

describe('i18n message dictionaries', () => {
  it('expose the same keys for English and Simplified Chinese', () => {
    expect(flattenKeys(zhCN).sort()).toEqual(flattenKeys(en).sort());
  });
});
