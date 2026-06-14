import type { PublicModelPrice } from '@nowcoding/core/cost';

export interface ModelPricingRow {
  model: string;
  input: string;
  cachedInput: string;
  output: string;
}

export interface ModelPricingMessages {
  perMillionTokens: string;
}

export const DEFAULT_MODEL_PRICING_MESSAGES = {
  perMillionTokens: '/ 1M',
} as const satisfies ModelPricingMessages;

export function buildModelPricingRows(
  prices: PublicModelPrice[],
  messages: ModelPricingMessages = DEFAULT_MODEL_PRICING_MESSAGES,
): ModelPricingRow[] {
  return prices.map((price) => ({
    model: price.id,
    input: formatUsdPerMillion(price.inputUsdPerMillionTokens, messages),
    cachedInput: formatUsdPerMillion(price.cachedInputUsdPerMillionTokens, messages),
    output: formatUsdPerMillion(price.outputUsdPerMillionTokens, messages),
  }));
}

function formatUsdPerMillion(value: number, messages: ModelPricingMessages): string {
  if (value > 0 && value < 0.01) {
    return `$${value.toFixed(6).replace(/0+$/, '')} ${messages.perMillionTokens}`;
  }

  return `$${value.toFixed(2)} ${messages.perMillionTokens}`;
}
