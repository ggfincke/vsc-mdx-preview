// verify CHANGELOG.md contains an entry for the current version
// runs as an npm "version" lifecycle hook — after package.json is
// bumped but before the commit & tag are created

import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const changelog = readFileSync('CHANGELOG.md', 'utf8');
const heading = `## [${version}]`;

if (!changelog.includes(heading)) {
  console.error(
    `\n  Missing changelog entry for v${version}.\n` +
      `  Add a "${heading}" section to CHANGELOG.md before running npm version.\n`,
  );
  process.exit(1);
}

console.log(`  Changelog entry found for v${version}`);
