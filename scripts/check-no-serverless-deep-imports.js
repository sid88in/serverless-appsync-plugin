#!/usr/bin/env node
/**
 * Guard against regressing issue #632.
 *
 * Serverless Framework v4's `serverless` npm package is a thin installer with
 * no `lib/` directory, so any runtime `require('serverless/lib/...')` in our
 * compiled output throws `Cannot find module 'serverless/lib/...'` on v4.
 *
 * We intentionally only reference Serverless internals via `import type`
 * (erased at compile time) or via the injected `serverless`/`utils` objects.
 * This script fails the build if a deep runtime require ever sneaks into the
 * emitted `lib/` output.
 */
'use strict';
/* eslint-disable @typescript-eslint/no-var-requires -- Node CJS tooling script */

const fs = require('fs');
const path = require('path');

const LIB_DIR = path.resolve(__dirname, '..', 'lib');
// Matches `require('serverless/lib/...')` / `require("serverless/lib/...")`.
const FORBIDDEN = /require\(\s*['"]serverless\/lib\//;

/** @param {string} dir @returns {string[]} */
function collectJsFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectJsFiles(full));
    else if (entry.isFile() && full.endsWith('.js')) out.push(full);
  }
  return out;
}

if (!fs.existsSync(LIB_DIR)) {
  console.error(
    `[check-no-serverless-deep-imports] lib/ not found at ${LIB_DIR}. Run \`npm run build\` first.`,
  );
  process.exit(1);
}

const offenders = collectJsFiles(LIB_DIR).filter((file) =>
  FORBIDDEN.test(fs.readFileSync(file, 'utf8')),
);

if (offenders.length > 0) {
  console.error(
    '[check-no-serverless-deep-imports] Forbidden runtime require of ' +
      "'serverless/lib/...' found in compiled output (this reintroduces #632 " +
      'on Serverless v4). Use `import type` instead:\n' +
      offenders.map((f) => `  - ${path.relative(LIB_DIR, f)}`).join('\n'),
  );
  process.exit(1);
}

console.log(
  '[check-no-serverless-deep-imports] OK — no deep serverless/lib requires in lib/.',
);
