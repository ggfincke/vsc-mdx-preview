// scripts/check-import-meta-shim.mjs
// assert CJS extension bundle shims import.meta.url for createRequire

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BUNDLE_PATH = join(process.cwd(), 'build/extension/extension.js');
const BANNER =
  "const import_meta_url = require('node:url').pathToFileURL(__filename).href";

// babel-style createRequire after esbuild wrap, still using raw import.meta.url
const UNSHIMMED_WRAPPED = /createRequire\)\(\s*import\.meta\.url\s*\)/;
// direct createRequire(import.meta.url); sucrase uses CREATE_REQUIRE_NAME so it is ignored
const UNSHIMMED_DIRECT = /createRequire\(\s*import\.meta\.url\s*\)/;

if (!existsSync(BUNDLE_PATH)) {
  console.error(
    `[import-meta-shim] missing ${BUNDLE_PATH} — run npm run build:extension first`
  );
  process.exit(1);
}

const source = readFileSync(BUNDLE_PATH, 'utf8');
const failures = [];

if (!source.includes(BANNER)) {
  failures.push('missing import_meta_url banner derived from __filename');
}

if (UNSHIMMED_WRAPPED.test(source) || UNSHIMMED_DIRECT.test(source)) {
  failures.push(
    'found createRequire(import.meta.url) — esbuild define/banner shim missing'
  );
}

if (!source.includes('createRequire)(import_meta_url)')) {
  failures.push(
    'expected shimmed createRequire)(import_meta_url) call sites (e.g. @babel/core)'
  );
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[import-meta-shim] ${failure}`);
  }
  process.exit(1);
}

console.log('[import-meta-shim] extension bundle import.meta.url shim OK');
