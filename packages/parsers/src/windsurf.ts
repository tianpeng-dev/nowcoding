import { BaseParser, type ParserContext, type ParserResult } from './_base/base-parser';

// Windsurf is a supported VSCode-fork host for Cline/Roo Code data, but the
// reference project does not expose a stable standalone Windsurf token parser.
// Keep this source explicit and disabled instead of accepting speculative JSONL.
export class WindsurfParser extends BaseParser {
  readonly source = 'windsurf';

  detect(_ctx: ParserContext): Promise<boolean> {
    return Promise.resolve(false);
  }

  async parse(_ctx: ParserContext): Promise<ParserResult> {
    return { source: this.source, records: [], errors: [] };
  }
}
