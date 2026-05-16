import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AntigravityParser } from '../src/index';
import { makeTempHome, parserContext, removeTempHome, writeFixture } from './helpers';

let tmp: string;

beforeEach(async () => {
  tmp = await makeTempHome('nowcoding-antigravity-');
});

afterEach(async () => {
  await removeTempHome(tmp);
});

describe('AntigravityParser', () => {
  it('detects Antigravity conversation cascade files', async () => {
    const parser = new AntigravityParser();

    expect(await parser.detect(parserContext(tmp))).toBe(false);

    await writeFixture(tmp, '.gemini/antigravity/conversations/cascade-a.pb', 'pb');

    expect(await parser.detect(parserContext(tmp))).toBe(true);
  });

  it('parses token usage from GetCascadeTrajectory RPC responses', async () => {
    const parser = new AntigravityParser({
      findServer: async () => ({ baseUrl: 'http://127.0.0.1:1234', csrfToken: 'token' }),
      rpc: async (_server, method, body) => {
        expect(method).toBe('GetCascadeTrajectory');
        expect(body).toEqual({ cascadeId: 'cascade-a' });
        return trajectoryFixture({
          responseModel: 'claude-sonnet-4-6-thinking',
          project: 'repo-a',
          usage: {
            responseId: 'response-a',
            inputTokens: 12,
            outputTokens: 8,
            cacheReadTokens: 4,
            thinkingOutputTokens: 3,
          },
        });
      },
    });
    await writeFixture(tmp, '.gemini/antigravity/conversations/cascade-a.pb', 'pb');

    const result = await parser.parse(parserContext(tmp, true));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      source: 'antigravity',
      model: 'claude-sonnet-4-6',
      project: 'repo-a',
      inputTokens: 12,
      outputTokens: 8,
      cachedInputTokens: 4,
      reasoningOutputTokens: 3,
      sessionId: 'cascade-a',
    });
  });

  it('resolves placeholder models and deduplicates response ids', async () => {
    const parser = new AntigravityParser({
      findServer: async () => ({ baseUrl: 'http://127.0.0.1:1234', csrfToken: 'token' }),
      rpc: async () =>
        trajectoryFixture({
          model: 'MODEL_PLACEHOLDER_M47',
          workspaceUri: 'file:///Users/peng/project-b',
          usage: {
            responseId: 'duplicate-response',
            inputTokens: 7,
            outputTokens: 5,
          },
          duplicateUsage: {
            responseId: 'duplicate-response',
            inputTokens: 100,
            outputTokens: 100,
          },
        }),
    });
    await writeFixture(tmp, '.gemini/antigravity/conversations/cascade-b.pb', 'pb');

    const result = await parser.parse(parserContext(tmp, true));

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      model: 'gemini-3-flash',
      project: 'project-b',
      inputTokens: 7,
      outputTokens: 5,
    });
  });

  it('diagnoses missing language server when conversations exist', async () => {
    const parser = new AntigravityParser({ findServer: async () => null });
    await writeFixture(tmp, '.gemini/antigravity/conversations/cascade-c.pb', 'pb');

    const result = await parser.parse(parserContext(tmp));

    expect(result.records).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.error).toContain('language server');
  });
});

interface TrajectoryFixtureOptions {
  responseModel?: string;
  model?: string;
  project?: string;
  workspaceUri?: string;
  usage: Record<string, unknown>;
  duplicateUsage?: Record<string, unknown>;
}

function trajectoryFixture(options: TrajectoryFixtureOptions): Record<string, unknown> {
  return {
    trajectory: {
      metadata: {
        workspaces: [
          {
            repository: options.project ? { computedName: options.project } : undefined,
            workspaceFolderAbsoluteUri: options.workspaceUri,
          },
        ],
      },
      generatorMetadata: [
        {
          chatModel: {
            responseModel: options.responseModel,
            model: options.model,
            chatStartMetadata: { createdAt: '2026-05-14T12:00:00.000Z' },
            retryInfos: [{ usage: options.usage }, { usage: options.duplicateUsage }],
          },
        },
      ],
    },
  };
}
