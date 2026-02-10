#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const defaultGateFile = path.resolve(
  rootDir,
  'dev-docs',
  'library-publication-gate.md'
);

function printUsageAndExit(code = 1) {
  console.error(
    'Usage: node scripts/check-library-publication-gate.mjs [--package <name>] [--file <path>]'
  );
  process.exit(code);
}

function parseArgs(argv) {
  const args = {
    packageName: null,
    gateFile: defaultGateFile,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      printUsageAndExit(0);
    }

    if (token === '--package') {
      const value = argv[i + 1];
      if (!value) {
        printUsageAndExit(1);
      }
      args.packageName = value.trim();
      i += 1;
      continue;
    }

    if (token === '--file') {
      const value = argv[i + 1];
      if (!value) {
        printUsageAndExit(1);
      }
      args.gateFile = path.resolve(process.cwd(), value);
      i += 1;
      continue;
    }

    console.error(`Unknown argument: ${token}`);
    printUsageAndExit(1);
  }

  return args;
}

function parseGateFile(markdown) {
  const outcomeMatch = markdown.match(/- Gate outcome:\s*\*\*(.+?)\*\*/i);
  if (!outcomeMatch) {
    throw new Error(
      'Could not parse gate outcome from library-publication-gate.md'
    );
  }

  const gateOutcome = outcomeMatch[1].trim();
  const gateSatisfied = gateOutcome.toLowerCase() === 'satisfied';

  const publishReadyByPackage = new Map();
  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('| `mdx-tools')) {
      continue;
    }

    const cells = trimmed
      .split('|')
      .map((cell) => cell.trim())
      .filter(Boolean);

    if (cells.length < 7) {
      continue;
    }

    const packageName = cells[0].replace(/^`|`$/g, '');
    const publishReady = cells[6].toLowerCase();
    publishReadyByPackage.set(packageName, publishReady);
  }

  return {
    gateOutcome,
    gateSatisfied,
    publishReadyByPackage,
  };
}

function isPublishReady(value) {
  return ['yes', 'ready', 'true', 'done', 'complete'].includes(value);
}

function fail(message) {
  console.error(`\nPublication gate check failed: ${message}`);
  process.exit(1);
}

function main() {
  const { packageName, gateFile } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(gateFile)) {
    fail(`gate file not found at ${gateFile}`);
  }

  const markdown = fs.readFileSync(gateFile, 'utf8');
  const parsed = parseGateFile(markdown);

  if (!parsed.gateSatisfied) {
    fail(
      `global gate outcome is "${parsed.gateOutcome}". Update ${path.relative(
        rootDir,
        gateFile
      )} before publishing.`
    );
  }

  if (packageName) {
    const publishReady = parsed.publishReadyByPackage.get(packageName);
    if (!publishReady) {
      fail(
        `package "${packageName}" is missing from the publication tracking table.`
      );
    }

    if (!isPublishReady(publishReady)) {
      fail(
        `package "${packageName}" is marked publish-ready="${publishReady}" (expected "yes").`
      );
    }

    console.log(`Publication gate passed for ${packageName}.`);
    return;
  }

  const notReady = Array.from(parsed.publishReadyByPackage.entries())
    .filter(([, value]) => !isPublishReady(value))
    .map(([name, value]) => `${name}=${value}`);

  if (notReady.length > 0) {
    fail(
      `some packages are not publish-ready: ${notReady.join(
        ', '
      )}. Update ${path.relative(rootDir, gateFile)}.`
    );
  }

  console.log('Publication gate passed for all @mdx-tools packages.');
}

main();
