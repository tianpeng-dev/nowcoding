import { describe, expect, it } from 'vitest';
import { estimateCostUsd, formatCostUsd } from '../src/cost';

describe('cost estimation', () => {
  it('estimates Claude Sonnet 4.x input, cached input, output, and reasoning cost', () => {
    expect(
      estimateCostUsd({
        model: 'claude-sonnet-4-6',
        inputTokens: 1_000_000,
        cachedInputTokens: 1_000_000,
        outputTokens: 1_000_000,
        reasoningOutputTokens: 1_000_000,
      }),
    ).toBe(33.3);
  });

  it('returns zero for unknown model names', () => {
    expect(
      estimateCostUsd({
        model: 'local-model',
        inputTokens: 1_000_000,
        cachedInputTokens: 1_000_000,
        outputTokens: 1_000_000,
        reasoningOutputTokens: 1_000_000,
      }),
    ).toBe(0);
  });

  it('formats cost for numeric database storage', () => {
    expect(formatCostUsd(0.1234567)).toBe('0.123457');
    expect(formatCostUsd(0)).toBe('0.000000');
  });
});
