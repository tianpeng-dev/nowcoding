export interface RawUsageRecord {
  source: string;
  model: string;
  project: string;
  timestamp: Date;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  reasoningOutputTokens?: number;
  sessionId?: string;
}

export interface BucketRecord {
  source: string;
  model: string;
  project: string;
  bucketStart: Date;
  inputTokens: bigint;
  outputTokens: bigint;
  cachedInputTokens: bigint;
  reasoningOutputTokens: bigint;
  totalTokens: bigint;
  requestCount: bigint;
}

export interface SessionRecord {
  source: string;
  project: string;
  sessionHash: string;
  firstMessageAt: Date;
  lastMessageAt: Date;
  durationSeconds: number;
  activeSeconds: number;
  messageCount: number;
  userMessageCount: number;
  userPromptHours: number[];
}

export interface PrivacySettings {
  uploadProject: boolean;
  uploadHostname: boolean;
  showCost: boolean;
  showLive: boolean;
}

export const PRIVACY_DEFAULTS_FAIL_CLOSED: PrivacySettings = {
  uploadProject: false,
  uploadHostname: false,
  showCost: false,
  showLive: false,
};

// Wire format types (BucketWire, SessionWire, IngestPayload) are
// authoritatively defined in `./schemas.ts` (zod-derived).
