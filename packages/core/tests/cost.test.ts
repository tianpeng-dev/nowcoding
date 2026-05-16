import { describe, expect, it } from 'vitest';
import {
  applyCostPrivacy,
  estimateCostUsd,
  estimateCostUsdDetailed,
  formatCostUsd,
  getModelPrice,
} from '../src/cost';
import { PRICE_VERSION } from '../src/schemas';

describe('cost estimation', () => {
  it('estimates Claude Sonnet 4.x input and output cost', () => {
    expect(
      estimateCostUsd({
        model: 'claude-sonnet-4-6',
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        cachedInputTokens: 0,
        reasoningOutputTokens: 0,
      }),
    ).toBe(18);
  });

  it('uses cache-read pricing for cached input tokens', () => {
    expect(
      estimateCostUsd({
        model: 'claude-sonnet-4-6',
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 1_000_000,
        reasoningOutputTokens: 0,
      }),
    ).toBe(0.3);
  });

  it('bills reasoning output tokens at output-token price', () => {
    expect(
      estimateCostUsd({
        model: 'gpt-5.4-mini',
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
        reasoningOutputTokens: 1_000_000,
      }),
    ).toBe(4.5);
  });

  it('returns zero for unknown model names without inventing prices', () => {
    expect(
      estimateCostUsdDetailed({
        model: 'local-llama',
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        cachedInputTokens: 1_000_000,
        reasoningOutputTokens: 1_000_000,
      }),
    ).toEqual({
      costUsd: 0,
      matchedModel: null,
      priceVersion: PRICE_VERSION,
    });
  });

  it('rejects invalid token inputs even for unknown model names', () => {
    const unknownModelInput = {
      model: 'local-llama',
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      reasoningOutputTokens: 0,
    };

    expect(() => estimateCostUsdDetailed({ ...unknownModelInput, inputTokens: -1 })).toThrow(
      RangeError,
    );
    expect(() =>
      estimateCostUsdDetailed({
        ...unknownModelInput,
        outputTokens: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
      }),
    ).toThrow(RangeError);
  });

  it('returns the matched model and current price version', () => {
    expect(getModelPrice('claude-opus-4.7')).toMatchObject({
      id: 'claude-opus-4.7',
      inputUsdPerMillionTokens: 5,
      cachedInputUsdPerMillionTokens: 0.5,
      outputUsdPerMillionTokens: 25,
    });
    expect(
      estimateCostUsdDetailed({
        model: 'claude-opus-4.7',
        inputTokens: 1,
        outputTokens: 0,
        cachedInputTokens: 0,
        reasoningOutputTokens: 0,
      }),
    ).toMatchObject({
      matchedModel: 'claude-opus-4.7',
      priceVersion: '2026-05-13-v1',
    });
  });

  it('does not match partial model versions', () => {
    expect(getModelPrice('claude-opus-4.70')).toBeNull();
  });

  it('matches GPT mini pricing before base GPT pricing', () => {
    expect(getModelPrice('gpt-5.4-mini')).toMatchObject({
      id: 'gpt-5.4-mini',
      inputUsdPerMillionTokens: 0.75,
      cachedInputUsdPerMillionTokens: 0.075,
      outputUsdPerMillionTokens: 4.5,
    });
  });

  it('matches Gemini text pricing and prefers Flash-Lite before Flash', () => {
    expect(getModelPrice('gemini-2.5-flash-lite')).toMatchObject({
      id: 'gemini-2.5-flash-lite',
      inputUsdPerMillionTokens: 0.1,
      cachedInputUsdPerMillionTokens: 0.025,
      outputUsdPerMillionTokens: 0.4,
    });
    expect(
      estimateCostUsd({
        model: 'gemini-2.5-pro',
        inputTokens: 1_000_000,
        cachedInputTokens: 1_000_000,
        outputTokens: 1_000_000,
      }),
    ).toBe(11.375);
  });

  it('matches DeepSeek V4 Flash pricing through legacy model aliases', () => {
    expect(getModelPrice('deepseek-chat')).toMatchObject({
      id: 'deepseek-v4-flash',
      inputUsdPerMillionTokens: 0.14,
      cachedInputUsdPerMillionTokens: 0.0028,
      outputUsdPerMillionTokens: 0.28,
    });
    expect(
      estimateCostUsdDetailed({
        model: 'deepseek-reasoner',
        inputTokens: 1_000_000,
        cachedInputTokens: 1_000_000,
        outputTokens: 1_000_000,
      }),
    ).toMatchObject({
      costUsd: 0.4228,
      matchedModel: 'deepseek-v4-flash',
    });
  });

  it('matches Qwen coding and flash pricing with explicit cache-hit rates', () => {
    expect(getModelPrice('qwen3-coder-plus')).toMatchObject({
      id: 'qwen3-coder-plus',
      inputUsdPerMillionTokens: 1,
      cachedInputUsdPerMillionTokens: 0.1,
      outputUsdPerMillionTokens: 5,
    });
    expect(
      estimateCostUsd({
        model: 'qwen3.5-flash',
        inputTokens: 1_000_000,
        cachedInputTokens: 1_000_000,
        outputTokens: 1_000_000,
      }),
    ).toBe(0.51);
  });

  it('matches Kimi coding model pricing with cache-hit rates', () => {
    expect(getModelPrice('kimi-k2.5')).toMatchObject({
      id: 'kimi-k2.5',
      inputUsdPerMillionTokens: 0.6,
      cachedInputUsdPerMillionTokens: 0.1,
      outputUsdPerMillionTokens: 3,
    });
    expect(
      estimateCostUsd({
        model: 'kimi-k2-turbo-preview',
        inputTokens: 1_000_000,
        cachedInputTokens: 1_000_000,
        outputTokens: 1_000_000,
      }),
    ).toBe(9.3);
  });

  it('matches xAI Grok text pricing', () => {
    expect(getModelPrice('grok-4.3')).toMatchObject({
      id: 'grok-4.3',
      inputUsdPerMillionTokens: 1.25,
      cachedInputUsdPerMillionTokens: 0.2,
      outputUsdPerMillionTokens: 2.5,
    });
    expect(
      estimateCostUsd({
        model: 'grok-4.20-0309-reasoning',
        inputTokens: 1_000_000,
        cachedInputTokens: 1_000_000,
        outputTokens: 1_000_000,
      }),
    ).toBe(3.95);
  });

  it('rejects invalid token inputs before estimating', () => {
    const validInput = {
      model: 'claude-sonnet-4-6',
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      reasoningOutputTokens: 0,
    };

    expect(() => estimateCostUsd({ ...validInput, inputTokens: -1 })).toThrow(RangeError);
    expect(() =>
      estimateCostUsd({ ...validInput, outputTokens: Number.POSITIVE_INFINITY }),
    ).toThrow(RangeError);
    expect(() =>
      estimateCostUsd({ ...validInput, cachedInputTokens: Number.MAX_SAFE_INTEGER + 1 }),
    ).toThrow(RangeError);
    expect(() =>
      estimateCostUsd({
        ...validInput,
        reasoningOutputTokens: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
      }),
    ).toThrow(RangeError);
  });

  it('formats cost for numeric(12,6) database storage', () => {
    expect(formatCostUsd(0.1234567)).toBe('0.123457');
    expect(formatCostUsd(0)).toBe('0.000000');
  });

  it('rejects invalid costs before formatting for database storage', () => {
    expect(() => formatCostUsd(Number.NaN)).toThrow(RangeError);
    expect(() => formatCostUsd(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => formatCostUsd(-0.01)).toThrow(RangeError);
  });

  it('trims public cost fields when showCost is false', () => {
    expect(applyCostPrivacy(1.25, true)).toEqual({
      estimatedCostUsd: 1.25,
      costLabel: 'estimated',
    });
    expect(applyCostPrivacy(1.25, false)).toEqual({
      estimatedCostUsd: null,
      costLabel: 'hidden',
    });
  });
});
