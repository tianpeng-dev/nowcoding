import { type CostLabel, PRICE_VERSION } from './schemas';

export interface CostInput {
  model: string;
  inputTokens: number | bigint;
  outputTokens: number | bigint;
  cachedInputTokens?: number | bigint;
  reasoningOutputTokens?: number | bigint;
}

export interface ModelPrice {
  id: string;
  inputUsdPerMillionTokens: number;
  cachedInputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
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

interface ModelPriceRule extends ModelPrice {
  match: RegExp;
}

// Pricing sources checked 2026-05-14:
// - Anthropic/OpenAI: existing v1 PRICE_VERSION table.
// - Google Gemini: https://ai.google.dev/gemini-api/docs/pricing
// - DeepSeek: https://api-docs.deepseek.com/quick_start/pricing/
// - Alibaba Cloud Model Studio: https://www.alibabacloud.com/help/en/model-studio/model-pricing
// - Alibaba Cloud context cache: https://www.alibabacloud.com/help/en/model-studio/context-cache
// - Kimi: https://platform.kimi.ai/docs/pricing/chat
// - xAI: https://docs.x.ai/developers/pricing
// Long-context, batch, region, modality, and promotional modifiers are not
// reconstructable from aggregate token buckets, so these entries use standard
// real-time text rates unless a provider publishes a direct cache-hit price.
const MODEL_PRICES: readonly ModelPriceRule[] = [
  {
    id: 'claude-opus-4.7',
    match: /(?:claude[-_ ]?)?opus[-_ ]?4(?:[._-]?7)(?=$|[^0-9.])/i,
    inputUsdPerMillionTokens: 5,
    cachedInputUsdPerMillionTokens: 0.5,
    outputUsdPerMillionTokens: 25,
  },
  {
    id: 'claude-opus-4.6',
    match: /(?:claude[-_ ]?)?opus[-_ ]?4(?:[._-]?6)(?=$|[^0-9.])/i,
    inputUsdPerMillionTokens: 5,
    cachedInputUsdPerMillionTokens: 0.5,
    outputUsdPerMillionTokens: 25,
  },
  {
    id: 'claude-opus-4.5',
    match: /(?:claude[-_ ]?)?opus[-_ ]?4(?:[._-]?5)(?=$|[^0-9.])/i,
    inputUsdPerMillionTokens: 5,
    cachedInputUsdPerMillionTokens: 0.5,
    outputUsdPerMillionTokens: 25,
  },
  {
    id: 'claude-opus-4.1',
    match: /(?:claude[-_ ]?)?opus[-_ ]?4(?:[._-]?1)(?=$|[^0-9.])/i,
    inputUsdPerMillionTokens: 15,
    cachedInputUsdPerMillionTokens: 1.5,
    outputUsdPerMillionTokens: 75,
  },
  {
    id: 'claude-opus-4',
    match: /(?:claude[-_ ]?)?opus[-_ ]?4(?![._-]?\d)(?=$|[^0-9.])/i,
    inputUsdPerMillionTokens: 15,
    cachedInputUsdPerMillionTokens: 1.5,
    outputUsdPerMillionTokens: 75,
  },
  {
    id: 'claude-sonnet-4.x',
    match: /(?:claude[-_ ]?)?sonnet[-_ ]?4(?:[._-]?[65])?(?=$|[^0-9.])/i,
    inputUsdPerMillionTokens: 3,
    cachedInputUsdPerMillionTokens: 0.3,
    outputUsdPerMillionTokens: 15,
  },
  {
    id: 'claude-sonnet-3.7',
    match: /(?:claude[-_ ]?)?sonnet[-_ ]?3(?:[._-]?7)(?=$|[^0-9.])/i,
    inputUsdPerMillionTokens: 3,
    cachedInputUsdPerMillionTokens: 0.3,
    outputUsdPerMillionTokens: 15,
  },
  {
    id: 'claude-haiku-4.5',
    match: /(?:claude[-_ ]?)?haiku[-_ ]?4(?:[._-]?5)(?=$|[^0-9.])/i,
    inputUsdPerMillionTokens: 1,
    cachedInputUsdPerMillionTokens: 0.1,
    outputUsdPerMillionTokens: 5,
  },
  {
    id: 'claude-haiku-3.5',
    match: /(?:claude[-_ ]?)?haiku[-_ ]?3(?:[._-]?5)(?=$|[^0-9.])/i,
    inputUsdPerMillionTokens: 0.8,
    cachedInputUsdPerMillionTokens: 0.08,
    outputUsdPerMillionTokens: 4,
  },
  {
    id: 'claude-haiku-3',
    match: /(?:claude[-_ ]?)?haiku[-_ ]?3(?![._-]?\d)(?=$|[^0-9.])/i,
    inputUsdPerMillionTokens: 0.25,
    cachedInputUsdPerMillionTokens: 0.03,
    outputUsdPerMillionTokens: 1.25,
  },
  // Standard rates for PRICE_VERSION. Long-context/request-level modifiers need
  // future per-request pricing metadata instead of aggregated bucket totals.
  {
    id: 'gpt-5.5',
    match: /gpt[-_ ]?5(?:[._-]?5)(?=$|[^0-9.])/i,
    inputUsdPerMillionTokens: 5,
    cachedInputUsdPerMillionTokens: 0.5,
    outputUsdPerMillionTokens: 30,
  },
  {
    id: 'gpt-5.4-mini',
    match: /gpt[-_ ]?5(?:[._-]?4)[-_ ]?mini(?=$|[^0-9.])/i,
    inputUsdPerMillionTokens: 0.75,
    cachedInputUsdPerMillionTokens: 0.075,
    outputUsdPerMillionTokens: 4.5,
  },
  {
    id: 'gpt-5.4',
    match: /gpt[-_ ]?5(?:[._-]?4)(?=$|[^0-9.])/i,
    inputUsdPerMillionTokens: 2.5,
    cachedInputUsdPerMillionTokens: 0.25,
    outputUsdPerMillionTokens: 15,
  },
  {
    id: 'gemini-2.5-pro',
    match: /gemini[-_ ]?2(?:[._-]?5)[-_ ]?pro(?=$|[^a-z0-9.])/i,
    inputUsdPerMillionTokens: 1.25,
    cachedInputUsdPerMillionTokens: 0.125,
    outputUsdPerMillionTokens: 10,
  },
  {
    id: 'gemini-2.5-flash-lite',
    match:
      /gemini[-_ ]?2(?:[._-]?5)[-_ ]?flash[-_ ]?lite(?:[-_ ]?preview(?:[-_ ]?\d{2}[-_ ]?\d{4})?)?(?=$|[^a-z0-9.])/i,
    inputUsdPerMillionTokens: 0.1,
    cachedInputUsdPerMillionTokens: 0.025,
    outputUsdPerMillionTokens: 0.4,
  },
  {
    id: 'gemini-2.5-flash',
    match:
      /gemini[-_ ]?2(?:[._-]?5)[-_ ]?flash(?![-_ ]?lite)(?:[-_ ]?preview(?:[-_ ]?\d{2}[-_ ]?\d{4})?)?(?=$|[^a-z0-9.])/i,
    inputUsdPerMillionTokens: 0.3,
    cachedInputUsdPerMillionTokens: 0.03,
    outputUsdPerMillionTokens: 2.5,
  },
  {
    id: 'deepseek-v4-flash',
    match: /deepseek[-_ ]?(?:v4[-_ ]?flash|chat|reasoner)(?=$|[^a-z0-9.])/i,
    inputUsdPerMillionTokens: 0.14,
    cachedInputUsdPerMillionTokens: 0.0028,
    outputUsdPerMillionTokens: 0.28,
  },
  // Alibaba Cloud international deployment rates, explicit cache hits billed at
  // 10% of standard input according to Model Studio context cache docs.
  {
    id: 'qwen3-coder-plus',
    match: /qwen3[-_.]?coder[-_ ]?plus(?:[-_ ]?\d{4}[-_ ]?\d{2}[-_ ]?\d{2})?(?=$|[^a-z0-9.])/i,
    inputUsdPerMillionTokens: 1,
    cachedInputUsdPerMillionTokens: 0.1,
    outputUsdPerMillionTokens: 5,
  },
  {
    id: 'qwen3.5-flash',
    match: /qwen3(?:[._-]?5)[-_ ]?flash(?:[-_ ]?\d{4}[-_ ]?\d{2}[-_ ]?\d{2})?(?=$|[^a-z0-9.])/i,
    inputUsdPerMillionTokens: 0.1,
    cachedInputUsdPerMillionTokens: 0.01,
    outputUsdPerMillionTokens: 0.4,
  },
  {
    id: 'qwen-flash',
    match: /qwen[-_ ]?flash(?:[-_ ]?\d{4}[-_ ]?\d{2}[-_ ]?\d{2})?(?=$|[^a-z0-9.])/i,
    inputUsdPerMillionTokens: 0.05,
    cachedInputUsdPerMillionTokens: 0.005,
    outputUsdPerMillionTokens: 0.4,
  },
  {
    id: 'kimi-k2.5',
    match: /kimi[-_ ]?k2(?:[._-]?5)(?=$|[^a-z0-9.])/i,
    inputUsdPerMillionTokens: 0.6,
    cachedInputUsdPerMillionTokens: 0.1,
    outputUsdPerMillionTokens: 3,
  },
  {
    id: 'kimi-k2-turbo',
    match: /kimi[-_ ]?k2[-_ ]?(?:thinking[-_ ]?)?turbo(?:[-_ ]?preview)?(?=$|[^a-z0-9.])/i,
    inputUsdPerMillionTokens: 1.15,
    cachedInputUsdPerMillionTokens: 0.15,
    outputUsdPerMillionTokens: 8,
  },
  {
    id: 'kimi-k2',
    match: /kimi[-_ ]?k2(?:[-_ ]?(?:0905|0711)[-_ ]?preview|[-_ ]?thinking)?(?=$|[^a-z0-9.])/i,
    inputUsdPerMillionTokens: 0.6,
    cachedInputUsdPerMillionTokens: 0.15,
    outputUsdPerMillionTokens: 2.5,
  },
  {
    id: 'grok-4.3',
    match: /grok[-_ ]?4(?:[._-]?3)(?:[-_ ]?latest)?(?=$|[^a-z0-9.])/i,
    inputUsdPerMillionTokens: 1.25,
    cachedInputUsdPerMillionTokens: 0.2,
    outputUsdPerMillionTokens: 2.5,
  },
  {
    id: 'grok-4.20',
    match:
      /grok[-_ ]?4(?:[._-]?20)(?:[-_ ]?multi[-_ ]?agent[-_ ]?0309|[-_ ]?0309[-_ ]?(?:non[-_ ]?reasoning|reasoning))?(?=$|[^a-z0-9.])/i,
    inputUsdPerMillionTokens: 1.25,
    cachedInputUsdPerMillionTokens: 0.2,
    outputUsdPerMillionTokens: 2.5,
  },
];

const TOKENS_PER_MILLION = 1_000_000;

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
