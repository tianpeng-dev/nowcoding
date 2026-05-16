import { describe, expect, it } from 'vitest';
import { buildHeartbeatPayload } from '../src/commands/heartbeat';

describe('buildHeartbeatPayload', () => {
  it('defaults to manual source, unknown project, and current observedAt', () => {
    const before = Date.now();
    const payload = buildHeartbeatPayload();
    const after = Date.now();

    expect(payload.source).toBe('manual');
    expect(payload.project).toBe('unknown');
    expect(payload.model).toBeUndefined();
    expect(Date.parse(payload.observedAt)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(payload.observedAt)).toBeLessThanOrEqual(after);
  });

  it('preserves source, model, project, and observedAt when provided', () => {
    expect(
      buildHeartbeatPayload({
        source: 'sync',
        model: 'gpt-5',
        project: 'nowcoding',
        observedAt: '2026-05-14T01:02:03.000Z',
      }),
    ).toEqual({
      source: 'sync',
      model: 'gpt-5',
      project: 'nowcoding',
      observedAt: '2026-05-14T01:02:03.000Z',
    });
  });

  it('trims text fields and falls back when required fields are blank', () => {
    expect(
      buildHeartbeatPayload({
        source: '   ',
        model: '  claude-sonnet-4-6  ',
        project: '',
        observedAt: '2026-05-14T01:02:03.000Z',
      }),
    ).toEqual({
      source: 'manual',
      model: 'claude-sonnet-4-6',
      project: 'unknown',
      observedAt: '2026-05-14T01:02:03.000Z',
    });
  });
});
