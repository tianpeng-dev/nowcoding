import { z } from 'zod';

export const CLOUD_DEFAULT_ENDPOINT = 'https://nowcoding.cc' as const;

export const cloudModeSchema = z.enum(['self-hosted', 'cloud']);
export type CloudMode = z.infer<typeof cloudModeSchema>;

export const deviceTokenSchema = z
  .string()
  .regex(/^nc_dev_[A-Za-z0-9_-]{43}$/, 'device token must use the nc_dev_ prefix');
export type DeviceToken = z.infer<typeof deviceTokenSchema>;

export const arenaPublicFieldSchema = z.enum([
  'username',
  'avatarUrl',
  'estimatedCost',
  'tokens',
  'activeTime',
  'streak',
  'source',
  'modelFamily',
]);

const defaultArenaPublicFields = [
  'username',
  'avatarUrl',
  'estimatedCost',
  'tokens',
  'activeTime',
  'streak',
] as const;

export const arenaConsentSchema = z.object({
  joined: z.boolean(),
  acceptedAt: z.string().datetime().nullable().default(null),
  publicFields: z.array(arenaPublicFieldSchema).default([...defaultArenaPublicFields]),
});
export type ArenaConsent = z.infer<typeof arenaConsentSchema>;

export const leaderboardRangeSchema = z.enum(['1d', '7d', '30d']).default('30d');
export const leaderboardMetricSchema = z
  .enum(['estimated_cost', 'tokens', 'active_time', 'streak', 'time_saved'])
  .default('tokens');
export const leaderboardScopeSchema = z
  .string()
  .regex(/^(all|source:[a-z0-9._-]+|model_family:[a-z0-9._-]+)$/)
  .default('all');

export const leaderboardQuerySchema = z.object({
  range: leaderboardRangeSchema,
  scope: leaderboardScopeSchema,
  metric: leaderboardMetricSchema,
});
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;
export type LeaderboardMetric = z.infer<typeof leaderboardMetricSchema>;

function formatOneDecimal(value: number): string {
  return value.toFixed(1);
}

function formatCurrencyLike(value: number): string {
  return `$${value.toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}`;
}

export function formatPublicLeaderboardValue({
  metric,
  value,
}: {
  metric: LeaderboardMetric;
  value: number;
}): string {
  switch (metric) {
    case 'tokens':
      if (value >= 2_000_000_000) {
        return '2B+';
      }
      if (value >= 1_000_000_000) {
        return `${formatOneDecimal(value / 1_000_000_000)}B`;
      }
      if (value >= 1_000_000) {
        return `${formatOneDecimal(value / 1_000_000)}M`;
      }
      if (value >= 1_000) {
        return `${formatOneDecimal(value / 1_000)}K`;
      }
      return Math.round(value).toLocaleString('en-US');
    case 'estimated_cost':
      return value >= 20_000 ? '$20,000+' : formatCurrencyLike(value);
    case 'active_time':
      return `${formatOneDecimal(value / 3600)}h`;
    case 'streak':
      return `${Math.round(value)}d`;
    case 'time_saved':
      if (value < 60) {
        return `${Math.round(value).toLocaleString('en-US')}m`;
      }
      return `${Math.round(value / 60).toLocaleString('en-US')}h`;
  }
}
