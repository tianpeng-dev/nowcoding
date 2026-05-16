import { z } from 'zod';

export const bucketWireSchema = z.object({
  source: z.string().min(1).max(64),
  model: z.string().min(1).max(128),
  project: z.string().min(1).max(255).default('unknown'),
  bucketStart: z.string().datetime(),
  inputTokens: z.number().int().nonnegative().max(1_000_000_000),
  outputTokens: z.number().int().nonnegative().max(1_000_000_000),
  cachedInputTokens: z.number().int().nonnegative().max(1_000_000_000).default(0),
  reasoningOutputTokens: z.number().int().nonnegative().max(1_000_000_000).default(0),
  totalTokens: z.number().int().nonnegative().max(2_000_000_000),
  requestCount: z.number().int().nonnegative().max(100_000).default(1),
});

export const sessionWireSchema = z.object({
  source: z.string().min(1).max(64),
  project: z.string().min(1).max(255).default('unknown'),
  sessionHash: z
    .string()
    .regex(/^[a-f0-9]{16}$/, 'sessionHash must be 16 hex chars (sha256 prefix)'),
  firstMessageAt: z.string().datetime(),
  lastMessageAt: z.string().datetime(),
  durationSeconds: z.number().int().nonnegative(),
  activeSeconds: z.number().int().nonnegative(),
  messageCount: z.number().int().nonnegative(),
  userMessageCount: z.number().int().nonnegative(),
  userPromptHours: z.array(z.number().int().nonnegative()).length(24),
});

export const ingestPayloadSchema = z.object({
  buckets: z.array(bucketWireSchema).max(20_000),
  sessions: z.array(sessionWireSchema).max(20_000).optional(),
});

export type IngestPayload = z.infer<typeof ingestPayloadSchema>;
export type BucketWire = z.infer<typeof bucketWireSchema>;
export type SessionWire = z.infer<typeof sessionWireSchema>;

export const PRICE_VERSION = '2026-05-13-v1' as const;

export const publicPeriodSchema = z.enum(['today', '7d', '30d', 'all']);
export const costLabelSchema = z.enum(['estimated', 'hidden']);
export const liveStatusSchema = z.enum(['live', 'recent', 'idle', 'inactive', 'private']);

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
  .refine((date) => {
    const parsed = new Date(`${date}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
  }, 'date must be a valid calendar date');
const nonnegativeNumberSchema = z.number().finite().nonnegative();
const nullableCostSchema = nonnegativeNumberSchema.nullable();
const shareSchema = z.number().finite().min(0).max(1);

export const heartbeatRequestSchema = z.object({
  source: z.string().min(1).max(64),
  model: z.string().min(1).max(128).optional(),
  project: z.string().min(1).max(255).default('unknown'),
  observedAt: z.string().datetime().optional(),
});

export const topItemSchema = z.object({
  name: z.string().min(1).max(255),
  share: shareSchema,
});

export const topShareSchema = topItemSchema;

export const distributionSchema = z.object({
  name: z.string().min(1).max(255),
  tokens: nonnegativeNumberSchema,
  share: shareSchema,
});

export const modelDistributionSchema = distributionSchema;

export const sourceDistributionSchema = distributionSchema;

export const streakSchema = z.object({
  current: z.number().int().nonnegative(),
  longest: z.number().int().nonnegative(),
  lastActiveDate: isoDateSchema.nullable(),
});

export const statsResponseSchema = z.object({
  period: publicPeriodSchema,
  totalTokens: nonnegativeNumberSchema,
  inputTokens: nonnegativeNumberSchema,
  outputTokens: nonnegativeNumberSchema,
  sessionCount: z.number().int().nonnegative(),
  activeSeconds: z.number().int().nonnegative(),
  estimatedCostUsd: nullableCostSchema,
  costLabel: costLabelSchema,
  topModel: topItemSchema.nullable(),
  topSource: topItemSchema.nullable(),
  topProject: topItemSchema.nullable(),
  modelDistribution: z.array(modelDistributionSchema),
  sourceDistribution: z.array(sourceDistributionSchema),
  streak: streakSchema,
  sparkline: z.array(nonnegativeNumberSchema),
  generatedAt: z.string().datetime(),
});

export const nowResponseSchema = z.object({
  status: liveStatusSchema,
  lastActiveAt: z.string().datetime().nullable(),
  currentSource: z.string().min(1).max(64).nullable(),
  currentModel: z.string().min(1).max(128).nullable(),
  todayTokens: nonnegativeNumberSchema,
  todayEstimatedCostUsd: nullableCostSchema,
  generatedAt: z.string().datetime(),
});

export const heatmapCellSchema = z.object({
  date: isoDateSchema,
  tokens: nonnegativeNumberSchema,
  estimatedCostUsd: nullableCostSchema,
  level: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});

export const heatmapResponseSchema = z.object({
  year: z.number().int().min(1970).max(9999),
  timezone: z.string().min(1).max(64),
  cells: z.array(heatmapCellSchema),
  generatedAt: z.string().datetime(),
});

export type PublicPeriod = z.infer<typeof publicPeriodSchema>;
export type CostLabel = z.infer<typeof costLabelSchema>;
export type LiveStatus = z.infer<typeof liveStatusSchema>;
export type HeartbeatRequest = z.infer<typeof heartbeatRequestSchema>;
export type StatsResponse = z.infer<typeof statsResponseSchema>;
export type NowResponse = z.infer<typeof nowResponseSchema>;
export type HeatmapCell = z.infer<typeof heatmapCellSchema>;
export type HeatmapResponse = z.infer<typeof heatmapResponseSchema>;
