import { inspectBucketForArena } from '@nowcoding/cloud-core';
import type { usageBuckets } from '@nowcoding/cloud-db';
import { type BucketWire, estimateCostUsd, formatCostUsd } from '@nowcoding/core';
import type { AuthenticatedDevice } from './device-auth';
type BucketInsertRow = typeof usageBuckets.$inferInsert;
function bucketKey(row: BucketInsertRow): string {
  return [
    row.userId,
    row.deviceId,
    row.source,
    row.model,
    row.project,
    row.bucketStart instanceof Date ? row.bucketStart.toISOString() : String(row.bucketStart),
    row.hostname,
  ].join('\0');
}

export function toBucketRows(
  buckets: BucketWire[],
  device: AuthenticatedDevice,
  hostname: string,
  now: Date,
): BucketInsertRow[] {
  const deduped = new Map<string, BucketInsertRow>();

  for (const bucket of buckets) {
    const promptTokens = BigInt(bucket.inputTokens) + BigInt(bucket.cachedInputTokens);
    const completionTokens = BigInt(bucket.outputTokens) + BigInt(bucket.reasoningOutputTokens);
    const totalTokens = BigInt(bucket.totalTokens);
    const derivedTotalTokens = promptTokens + completionTokens;

    if (totalTokens < derivedTotalTokens) {
      throw new Error('underreported_total_tokens');
    }

    const inspection = inspectBucketForArena(
      {
        bucketStart: bucket.bucketStart,
        totalTokens: bucket.totalTokens,
        inputTokens: bucket.inputTokens,
        outputTokens: bucket.outputTokens,
        cachedInputTokens: bucket.cachedInputTokens,
        reasoningOutputTokens: bucket.reasoningOutputTokens,
      },
      now,
    );
    const row: BucketInsertRow = {
      userId: device.userId,
      deviceId: device.id,
      source: bucket.source,
      model: bucket.model,
      project: bucket.project.trim() || 'unknown',
      hostname,
      bucketStart: new Date(bucket.bucketStart),
      promptTokens,
      completionTokens,
      totalTokens,
      requestCount: BigInt(bucket.requestCount),
      costUsd: formatCostUsd(estimateCostUsd(bucket)),
      excludedFromArenaAt: inspection.accepted ? null : now,
    };

    deduped.set(bucketKey(row), row);
  }

  return Array.from(deduped.values());
}
