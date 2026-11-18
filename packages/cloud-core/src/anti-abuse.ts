export type ArenaBucketInspection =
  | { accepted: true; reason: null }
  | { accepted: false; reason: string };

export type ArenaBucketInspectionInput = {
  bucketStart: string;
  totalTokens: number;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  reasoningOutputTokens?: number;
};

const FUTURE_TOLERANCE_MS = 10 * 60 * 1000;
const EXTREME_SINGLE_ROW_TOKENS = 2_000_000_000;

function validTokenCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function effectiveTotalTokens(bucket: ArenaBucketInspectionInput): number {
  const tokenComponents = [
    bucket.inputTokens,
    bucket.outputTokens,
    bucket.cachedInputTokens,
    bucket.reasoningOutputTokens,
  ];

  if (tokenComponents.every((value) => typeof value === 'number')) {
    return Math.max(
      bucket.totalTokens,
      tokenComponents.reduce((total, value) => total + (value ?? 0), 0),
    );
  }

  return bucket.totalTokens;
}

export function inspectBucketForArena(
  bucket: ArenaBucketInspectionInput,
  now = new Date(),
): ArenaBucketInspection {
  const bucketStart = new Date(bucket.bucketStart);
  const tokenValues = [
    bucket.totalTokens,
    bucket.inputTokens,
    bucket.outputTokens,
    bucket.cachedInputTokens,
    bucket.reasoningOutputTokens,
  ].filter((value) => typeof value === 'number');

  if (bucketStart.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    return { accepted: false, reason: 'future_timestamp' };
  }

  if (tokenValues.some((value) => !validTokenCount(value))) {
    return { accepted: false, reason: 'invalid_tokens' };
  }

  if (effectiveTotalTokens(bucket) > EXTREME_SINGLE_ROW_TOKENS) {
    return { accepted: false, reason: 'extreme_single_row_tokens' };
  }

  return { accepted: true, reason: null };
}
