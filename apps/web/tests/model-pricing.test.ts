import { describe, expect, it } from 'vitest';
import { buildModelPricingRows } from '../lib/model-pricing';

describe('model pricing rows', () => {
  it('formats gpt-5.5 public pricing per million tokens', () => {
    expect(
      buildModelPricingRows([
        {
          id: 'gpt-5.5',
          inputUsdPerMillionTokens: 5,
          cachedInputUsdPerMillionTokens: 0.5,
          outputUsdPerMillionTokens: 30,
        },
      ]),
    ).toEqual([
      {
        model: 'gpt-5.5',
        input: '$5.00 / 1M',
        cachedInput: '$0.50 / 1M',
        output: '$30.00 / 1M',
      },
    ]);
  });

  it('preserves nonzero sub-cent cached input prices', () => {
    const rows = buildModelPricingRows([
      {
        id: 'deepseek-v4-flash',
        inputUsdPerMillionTokens: 0.14,
        cachedInputUsdPerMillionTokens: 0.0028,
        outputUsdPerMillionTokens: 0.28,
      },
    ]);

    expect(rows).toHaveLength(1);
    const row = rows[0];
    if (!row) throw new Error('Expected one pricing row');
    expect(row.cachedInput).toBe('$0.0028 / 1M');
    expect(row.cachedInput).not.toBe('$0.00 / 1M');
  });
});
