import type { PublicModelPrice } from '@nowcoding/core/cost';

export interface ModelPricingRow {
  model: string;
  input: string;
  cachedInput: string;
  output: string;
}

export function buildModelPricingRows(prices: PublicModelPrice[]): ModelPricingRow[] {
  return prices.map((price) => ({
    model: price.id,
    input: formatUsdPerMillion(price.inputUsdPerMillionTokens),
    cachedInput: formatUsdPerMillion(price.cachedInputUsdPerMillionTokens),
    output: formatUsdPerMillion(price.outputUsdPerMillionTokens),
  }));
}

function formatUsdPerMillion(value: number): string {
  if (value > 0 && value < 0.01) {
    return `$${value.toFixed(6).replace(/0+$/, '')} / 1M`;
  }

  return `$${value.toFixed(2)} / 1M`;
}
