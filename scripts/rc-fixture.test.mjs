import { heartbeatRequestSchema, ingestPayloadSchema } from '@nowcoding/core';
import { describe, expect, test } from 'vitest';

import { buildRcFixture } from './rc-fixture.mjs';

describe('buildRcFixture', () => {
  test('builds safe release candidate smoke data that matches public schemas', () => {
    const fixture = buildRcFixture(new Date('2026-05-14T08:30:00.000Z'));

    expect(() => ingestPayloadSchema.parse(fixture.ingest)).not.toThrow();
    expect(() => heartbeatRequestSchema.parse(fixture.heartbeat)).not.toThrow();
    expect(fixture.hostname).toBe('nowcoding-rc-rehearsal');
    expect(fixture.ingest.buckets).toHaveLength(4);
    expect(fixture.ingest.sessions).toHaveLength(2);
    expect(fixture.heartbeat.source).toBe('codex');
    expect(fixture.heartbeat.model).toBe('gpt-5.5');
    expect(JSON.stringify(fixture)).not.toMatch(/prompt|secret|token|password|peng/i);
    expect(JSON.stringify(fixture)).not.toMatch(/nc_[a-z]+_/);
    expect(JSON.stringify(fixture)).not.toContain('.local');
    expect(fixture.ingest.buckets.map((bucket) => bucket.bucketStart)).toEqual([
      '2026-05-14T08:00:00.000Z',
      '2026-05-14T07:00:00.000Z',
      '2026-05-13T08:00:00.000Z',
      '2026-05-08T08:00:00.000Z',
    ]);
    expect(fixture.heartbeat.observedAt).toBe('2026-05-14T08:30:00.000Z');
  });
});
