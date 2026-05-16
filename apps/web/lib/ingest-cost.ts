import { type BucketWire, PRICE_VERSION, estimateCostUsd, formatCostUsd } from '@nowcoding/core';

export function buildBucketInsertRows(buckets: BucketWire[], hostname: string) {
  const normalizedHostname = hostname.trim() || 'unknown';

  return buckets.map((bucket) => ({
    source: bucket.source,
    model: bucket.model,
    project: bucket.project.trim() || 'unknown',
    hostname: normalizedHostname,
    bucketStart: new Date(bucket.bucketStart),
    inputTokens: BigInt(bucket.inputTokens),
    outputTokens: BigInt(bucket.outputTokens),
    cachedInputTokens: BigInt(bucket.cachedInputTokens),
    reasoningOutputTokens: BigInt(bucket.reasoningOutputTokens),
    totalTokens: BigInt(bucket.totalTokens),
    requestCount: BigInt(bucket.requestCount ?? 1),
    costUsd: formatCostUsd(estimateCostUsd(bucket)),
    priceVersion: PRICE_VERSION,
  }));
}
