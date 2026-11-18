import { estimateCostUsdDetailed } from '@nowcoding/core';
import { collect } from './collect';

const dayKey = (time: Date) =>
  [
    time.getFullYear(),
    String(time.getMonth() + 1).padStart(2, '0'),
    String(time.getDate()).padStart(2, '0'),
  ].join('-');

export async function localActivity(sources: string[]) {
  const { buckets, errors } = await collect(sources);
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - 6 + index);
    return { day: dayKey(date), tokens: 0 };
  });
  const week = new Map(days.map((day) => [day.day, day]));
  const models = new Map<string, number>();
  let costUsd = 0;
  let unpricedTokens = 0;
  for (const bucket of buckets) {
    const day = week.get(dayKey(bucket.bucketStart));
    if (!day) continue;
    const tokens = Number(bucket.totalTokens);
    day.tokens += tokens;
    models.set(bucket.model, (models.get(bucket.model) ?? 0) + tokens);
    const estimate = estimateCostUsdDetailed(bucket);
    if (estimate.matchedModel) costUsd += estimate.costUsd;
    else unpricedTokens += tokens;
  }
  return {
    days,
    models: [...models].sort((a, b) => b[1] - a[1]),
    costUsd,
    unpricedTokens,
    activeDays: days.filter((d) => d.tokens > 0).length,
    errors,
  };
}
