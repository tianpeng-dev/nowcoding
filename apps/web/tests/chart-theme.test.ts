import { describe, expect, it } from 'vitest';
import { getAiCodingThemeColor } from '../lib/chart-theme';

describe('AI coding chart theme colors', () => {
  it('uses product theme colors for known coding tools', () => {
    expect(getAiCodingThemeColor('codex')).toBe('#10a37f');
    expect(getAiCodingThemeColor('claude-code')).toBe('#d97757');
    expect(getAiCodingThemeColor('gemini-cli')).toBe('#4285f4');
    expect(getAiCodingThemeColor('qwen-code')).toBe('#615ced');
  });

  it('infers model provider colors for model distribution charts', () => {
    expect(getAiCodingThemeColor('claude-sonnet-4-6')).toBe('#d97757');
    expect(getAiCodingThemeColor('gpt-5.2-codex')).toBe('#10a37f');
    expect(getAiCodingThemeColor('gemini-2.5-pro')).toBe('#4285f4');
    expect(getAiCodingThemeColor('kimi-k2')).toBe('#00d2ff');
  });

  it('keeps unknown entries deterministic and varied', () => {
    expect(getAiCodingThemeColor('unknown-one')).toBe(getAiCodingThemeColor('unknown-one'));
    expect(getAiCodingThemeColor('unknown-one')).not.toBe(getAiCodingThemeColor('unknown-two'));
  });
});
