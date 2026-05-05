#!/usr/bin/env node
// scripts/check-mdx-forge-deps.mjs
// ensure all workspaces use the root mdx-forge dependency range

import { readFileSync } from 'node:fs';

const WORKSPACE_PACKAGE_JSON = [
  'packages/codegen/package.json',
  'packages/extension-host/package.json',
  'packages/webview-client/package.json',
];

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

const rootPackage = readJson('package.json');
const rootRange = rootPackage.dependencies?.['mdx-forge'];
const failures = [];

if (!rootRange) {
  failures.push('root package.json is missing dependencies.mdx-forge');
}

for (const packagePath of WORKSPACE_PACKAGE_JSON) {
  const workspacePackage = readJson(packagePath);
  const workspaceRange = workspacePackage.dependencies?.['mdx-forge'];

  if (workspaceRange !== rootRange) {
    failures.push(
      `${packagePath} uses mdx-forge ${workspaceRange ?? 'missing'}; ` +
        `expected ${rootRange}`
    );
  }
}

const lock = readJson('package-lock.json');
const nestedLockEntries = Object.keys(lock.packages ?? {}).filter((key) =>
  key.startsWith('packages/') ? key.endsWith('/node_modules/mdx-forge') : false
);

if (nestedLockEntries.length > 0) {
  failures.push(
    `package-lock.json contains nested mdx-forge installs: ` +
      nestedLockEntries.join(', ')
  );
}

if (failures.length > 0) {
  console.error('mdx-forge dependency check failed:');
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log(`mdx-forge dependency check passed (${rootRange})`);
