import { MODEL_PRICES, type ModelPrice, TOKENS_PER_MILLION } from './model-prices';
import { type CostLabel, PRICE_VERSION } from './schemas';

export type { ModelPrice };

export interface CostInput {
  model: string;
  inputTokens: number | bigint;
  outputTokens: number | bigint;
  cachedInputTokens?: number | bigint;
  reasoningOutputTokens?: number | bigint;
}

export interface PublicModelPrice {
  id: string;
  inputUsdPerMillionTokens: number;
  cachedInputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
}

export interface CostEstimate {
  costUsd: number;
  matchedModel: string | null;
  priceVersion: typeof PRICE_VERSION;
}

export function getModelPrice(model: string): ModelPrice | null {
  const normalized = model.trim();
  const matched = MODEL_PRICES.find((price) => price.match.test(normalized));
  if (!matched) return null;

  return {
    id: matched.id,
    inputUsdPerMillionTokens: matched.inputUsdPerMillionTokens,
    cachedInputUsdPerMillionTokens: matched.cachedInputUsdPerMillionTokens,
    outputUsdPerMillionTokens: matched.outputUsdPerMillionTokens,
  };
}

export function publicModelPrices(): PublicModelPrice[] {
  return MODEL_PRICES.map(
    ({
      id,
      inputUsdPerMillionTokens,
      cachedInputUsdPerMillionTokens,
      outputUsdPerMillionTokens,
    }) => ({
      id,
      inputUsdPerMillionTokens,
      cachedInputUsdPerMillionTokens,
      outputUsdPerMillionTokens,
    }),
  );
}

export function estimateCostUsdDetailed(input: CostInput): CostEstimate {
  const inputTokens = validateTokenCount(input.inputTokens, 'inputTokens');
  const outputTokens = validateTokenCount(input.outputTokens, 'outputTokens');
  const cachedInputTokens = validateTokenCount(input.cachedInputTokens ?? 0, 'cachedInputTokens');
  const reasoningOutputTokens = validateTokenCount(
    input.reasoningOutputTokens ?? 0,
    'reasoningOutputTokens',
  );

  const price = getModelPrice(input.model);
  if (!price) {
    return {
      costUsd: 0,
      matchedModel: null,
      priceVersion: PRICE_VERSION,
    };
  }

  const costUsd =
    (inputTokens / TOKENS_PER_MILLION) * price.inputUsdPerMillionTokens +
    (cachedInputTokens / TOKENS_PER_MILLION) * price.cachedInputUsdPerMillionTokens +
    ((outputTokens + reasoningOutputTokens) / TOKENS_PER_MILLION) * price.outputUsdPerMillionTokens;

  return {
    costUsd: roundCostUsd(costUsd),
    matchedModel: price.id,
    priceVersion: PRICE_VERSION,
  };
}

export function estimateCostUsd(input: CostInput): number {
  return estimateCostUsdDetailed(input).costUsd;
}

export function formatCostUsd(costUsd: number): string {
  validateCostUsd(costUsd);
  return roundCostUsd(costUsd).toFixed(6);
}

export function applyCostPrivacy(
  estimatedCostUsd: number | null,
  showCost: boolean,
): { estimatedCostUsd: number | null; costLabel: CostLabel } {
  if (!showCost) return { estimatedCostUsd: null, costLabel: 'hidden' };
  return { estimatedCostUsd, costLabel: 'estimated' };
}

function roundCostUsd(value: number): number {
  return Number(value.toFixed(6));
}

function validateTokenCount(value: number | bigint, fieldName: string): number {
  if (typeof value === 'bigint') {
    if (value < 0n) {
      throw new RangeError(`${fieldName} must be non-negative`);
    }
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new RangeError(`${fieldName} must be less than or equal to Number.MAX_SAFE_INTEGER`);
    }
    return Number(value);
  }

  if (typeof value !== 'number') {
    throw new TypeError(`${fieldName} must be a number or bigint`);
  }
  if (!Number.isFinite(value)) {
    throw new RangeError(`${fieldName} must be finite`);
  }
  if (!Number.isInteger(value)) {
    throw new RangeError(`${fieldName} must be an integer`);
  }
  if (value < 0) {
    throw new RangeError(`${fieldName} must be non-negative`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${fieldName} must be a safe integer`);
  }

  return value;
}

function validateCostUsd(costUsd: number): void {
  if (typeof costUsd !== 'number') {
    throw new TypeError('costUsd must be a number');
  }
  if (!Number.isFinite(costUsd)) {
    throw new RangeError('costUsd must be finite');
  }
  if (costUsd < 0) {
    throw new RangeError('costUsd must be non-negative');
  }
}
