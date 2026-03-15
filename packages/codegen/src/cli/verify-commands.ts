// packages/codegen/src/cli/verify-commands.ts
// verify command parity between CommandNames & package.json manifest
// run in CI to catch command drift

import * as fs from 'fs';
import * as path from 'path';
import { getRootDir } from './cli-utils';

const ROOT_DIR = getRootDir(import.meta.url);
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');
const COMMAND_NAMES_PATH = path.join(
  ROOT_DIR,
  'packages/extension-host/src/features/commands/command-names.ts'
);

// command IDs that are code-action only (not in package.json manifest)
const CODE_ACTION_ONLY = new Set(['mdx-preview.addComponentToConfig']);

function main(): void {
  console.log('Verifying command parity...\n');

  const errors: string[] = [];

  // read command-names.ts as text & parse command IDs via regex
  const commandNamesSource = fs.readFileSync(COMMAND_NAMES_PATH, 'utf-8');
  const commandIdRegex = /'(mdx-preview\.[^']+)'/g;
  const sourceCommandIds = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = commandIdRegex.exec(commandNamesSource)) !== null) {
    sourceCommandIds.add(match[1]);
  }

  if (sourceCommandIds.size === 0) {
    errors.push('No command IDs found in command-names.ts');
    reportAndExit(errors);
    return;
  }

  // read package.json & extract contributes.commands
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
  const manifestCommands: Array<{ command: string }> =
    packageJson.contributes?.commands ?? [];
  const manifestCommandIds = new Set(manifestCommands.map((c) => c.command));

  // forward check: every CommandNames value (except code-action only)
  // must exist in package.json commands
  for (const id of sourceCommandIds) {
    if (CODE_ACTION_ONLY.has(id)) {
      continue;
    }
    if (!manifestCommandIds.has(id)) {
      errors.push(
        `Missing in package.json: ${id} (defined in CommandNames but not in manifest)`
      );
    }
  }

  // reverse check: every package.json command must exist in CommandNames
  for (const id of manifestCommandIds) {
    if (!sourceCommandIds.has(id)) {
      errors.push(
        `Missing in CommandNames: ${id} (in package.json but not in command-names.ts)`
      );
    }
  }

  // verify code-action only commands are NOT in package.json
  for (const id of CODE_ACTION_ONLY) {
    if (manifestCommandIds.has(id)) {
      errors.push(
        `Code-action only command should not be in package.json: ${id}`
      );
    }
  }

  reportAndExit(errors);
}

function reportAndExit(errors: string[]): void {
  if (errors.length > 0) {
    console.error('Command parity verification FAILED:\n');
    errors.forEach((error) => console.error(`  ${error}\n`));
    console.error(
      '\nTo fix: ensure CommandNames in command-names.ts & package.json\n' +
        'contributes.commands are in sync.\n'
    );
    process.exit(1);
  }

  console.log('Command parity verification PASSED!\n');
  console.log('Checked:');
  console.log('  - all CommandNames values exist in package.json manifest');
  console.log('  - all package.json commands exist in CommandNames');
  console.log('  - code-action only commands excluded from manifest');
}

main();
