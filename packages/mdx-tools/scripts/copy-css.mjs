// packages/mdx-tools/scripts/copy-css.mjs
// copy CSS files from src/components/ to dist/components/

import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const srcDir = resolve('src/components');
const outDir = resolve('dist/components');

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full);
      continue;
    }

    if (!name.endsWith('.css')) {
      continue;
    }

    const rel = full.slice(srcDir.length + 1);
    const dest = join(outDir, rel);
    const parent = dirname(dest);
    if (!existsSync(parent)) {
      mkdirSync(parent, { recursive: true });
    }
    cpSync(full, dest);
  }
}

walk(srcDir);
