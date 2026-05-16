#!/usr/bin/env node
import('../dist/index.js').then(
  (m) => m.main(process.argv.slice(2)),
  (err) => {
    console.error('[nowcoding] failed to start:', err);
    process.exit(1);
  },
);
