import { describe, expect, it } from 'vitest';
import { formatParserDoctorLine } from '../src/commands/doctor';

describe('formatParserDoctorLine', () => {
  it('includes source, support status, data kind, and detection', () => {
    expect(
      formatParserDoctorLine({
        source: 'codex',
        status: 'full',
        dataKind: 'jsonl',
        detected: true,
      }),
    ).toBe('Parser codex [full/jsonl]: detected');
  });

  it('marks missing parsers without treating them as errors', () => {
    expect(
      formatParserDoctorLine({
        source: 'gemini-cli',
        status: 'generic',
        dataKind: 'jsonl',
        detected: false,
      }),
    ).toBe('Parser gemini-cli [generic/jsonl]: not present');
  });
});
