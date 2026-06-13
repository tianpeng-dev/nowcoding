export interface ModelPrice {
  id: string;
  inputUsdPerMillionTokens: number;
  cachedInputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
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
export const MODEL_PRICES: readonly ModelPriceRule[] = [
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

export const TOKENS_PER_MILLION = 1_000_000;
