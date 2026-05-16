// scripts/check-no-linked-deps.mjs
// verify that no dependencies are npm-linked (symlinked)
// prevents shipping local symlinks instead of real npm installs

import { lstatSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const NODE_MODULES = 'node_modules';

// dependencies to check for symlinks
const DEPS_TO_CHECK = ['mdx-forge'];

let failed = false;

for (const dep of DEPS_TO_CHECK) {
  const depPath = join(NODE_MODULES, dep);
  try {
    const stat = lstatSync(depPath);
    if (stat.isSymbolicLink()) {
      console.error(
        `[no-link] ${dep} is symlinked — run \`npm unlink mdx-forge && npm install\` before packaging`
      );
      failed = true;
    }
  } catch {
    // dependency not installed yet, skip
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log('No linked dependencies detected');
}
