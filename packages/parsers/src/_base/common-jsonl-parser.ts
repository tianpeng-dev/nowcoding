import type { MessageRecord } from '@nowcoding/core';
import { JsonlParser, type JsonlParserConfig } from './jsonl-parser';

/**
 * Many AI coding tools log usage records that resemble the OpenAI/Anthropic
 * shape: { timestamp, model, usage: { input_tokens, output_tokens } }.
 * This base assumes that shape and lets subclasses just declare their path
 * and source name.
 *
 * Tools with custom shapes should extend JsonlParser directly and implement
 * toRecord themselves (see claude-code.ts for an example).
 */
export abstract class CommonJsonlParser extends JsonlParser {
  abstract override readonly source: string;
  abstract override readonly config: JsonlParserConfig;

  protected toRecord(line: unknown, project: string): MessageRecord | null {
    if (!line || typeof line !== 'object') return null;
    const e = line as CommonShape;
    const tsRaw = e.timestamp ?? e.created_at ?? e.time;
    if (!tsRaw) return null;
    const ts = new Date(tsRaw);
    if (Number.isNaN(ts.getTime())) return null;

    const usage = e.usage ?? e.message?.usage;
    if (!usage) return null;
    const input = usage.input_tokens ?? usage.prompt_tokens ?? usage.inputTokens ?? 0;
    const output = usage.output_tokens ?? usage.completion_tokens ?? usage.outputTokens ?? 0;
    const cached =
      (usage.cache_read_input_tokens ?? 0) +
      (usage.cache_creation_input_tokens ?? 0) +
      (usage.cached_input_tokens ?? 0);
    if (input === 0 && output === 0 && cached === 0) return null;

    const model = e.model ?? e.message?.model ?? e.modelName ?? e.model_name ?? 'unknown';
    const sessionId = e.sessionId ?? e.session_id ?? e.conversationId;
    const role = e.role ?? e.message?.role;

    return {
      source: this.source,
      model,
      project,
      timestamp: ts,
      inputTokens: input,
      outputTokens: output,
      cachedInputTokens: cached,
      sessionId,
      isUser: role === 'user',
    };
  }
}

interface CommonShape {
  timestamp?: string;
  created_at?: string;
  time?: string;
  model?: string;
  modelName?: string;
  model_name?: string;
  role?: string;
  sessionId?: string;
  session_id?: string;
  conversationId?: string;
  usage?: CommonUsage;
  message?: { model?: string; role?: string; usage?: CommonUsage };
}

interface CommonUsage {
  input_tokens?: number;
  output_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  cached_input_tokens?: number;
}
