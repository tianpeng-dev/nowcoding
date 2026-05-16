import { BaseParser, type ParserContext, type ParserResult } from './_base/base-parser';

// P1-2: Cursor stores usage in a SQLite DB and historically has only had a
// private dashboard CSV export endpoint at cursor.com. We do NOT scrape that
// endpoint, and we require the user to opt-in explicitly (twice) at `init`
// time before parsing the local SQLite. Until W4 finalises the SQLite schema
// path on supported OSes, this parser stays a deliberate no-op.
//
// To enable: set `cursorOptIn: true` on the CLI config (only after the user
// has confirmed `yes` interactively in `nowcoding init`).
export class CursorParser extends BaseParser {
  readonly source = 'cursor';

  detect(_ctx: ParserContext): Promise<boolean> {
    // Always false in v1.0 unless the user opts in via a future config flag.
    // Returning false here means `sync` simply skips this tool.
    return Promise.resolve(false);
  }

  async parse(_ctx: ParserContext): Promise<ParserResult> {
    return { source: this.source, records: [], errors: [] };
  }
}
