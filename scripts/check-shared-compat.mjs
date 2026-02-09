// scripts/check-shared-compat.mjs
// enforce shared compatibility facade guardrails
// - re-export-only (no local declarations or logic)
// - re-exports must come only from allowed packages
// - file length must stay under the configured limit

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const SHARED_FACADE_PATH = 'packages/shared/index.ts';
const MAX_LINES = 300;
const ALLOWED_MODULES = new Set([
  '@mdx-preview/contracts',
  '@mdx-preview/registry',
  '@mdx-preview/runtime-utils',
]);

function getLineNumber(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
    .line + 1;
}

function isAllowedReExport(statement) {
  if (!ts.isExportDeclaration(statement)) {
    return false;
  }

  if (!statement.moduleSpecifier) {
    return false;
  }

  if (!ts.isStringLiteral(statement.moduleSpecifier)) {
    return false;
  }

  return ALLOWED_MODULES.has(statement.moduleSpecifier.text);
}

function main() {
  const sharedPath = resolve(process.cwd(), SHARED_FACADE_PATH);
  const sourceText = readFileSync(sharedPath, 'utf-8');
  const lineCount = sourceText.split(/\r?\n/).length;
  const sourceFile = ts.createSourceFile(
    SHARED_FACADE_PATH,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  const violations = [];
  if (lineCount > MAX_LINES) {
    violations.push(
      `Line count exceeds limit: ${lineCount} > ${MAX_LINES} (${SHARED_FACADE_PATH})`
    );
  }

  let exportDeclarationCount = 0;
  for (const statement of sourceFile.statements) {
    if (!isAllowedReExport(statement)) {
      const line = getLineNumber(sourceFile, statement);
      const kind = ts.SyntaxKind[statement.kind] ?? String(statement.kind);
      violations.push(
        `Disallowed top-level statement at line ${line}: ${kind} (only re-exports from allowed packages are permitted)`
      );
      continue;
    }
    exportDeclarationCount += 1;
  }

  if (violations.length > 0) {
    console.error('Shared compatibility facade guardrail violations:');
    for (const violation of violations) {
      console.error(`  - ${violation}`);
    }
    process.exit(1);
  }

  console.log(
    `Shared facade guardrails passed (${exportDeclarationCount} re-export statements, ${lineCount} lines).`
  );
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Error checking shared compatibility facade:', message);
  process.exit(1);
}
