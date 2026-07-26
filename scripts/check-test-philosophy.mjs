// scripts/check-test-philosophy.mjs
// enforce production-critical test suite scope & case-count caps

import fs from 'node:fs';
import path from 'node:path';
import { collectFiles } from './lib/file-walk.mjs';

const EXACT_ALLOWED = new Set([
  'tests/compilation/safe-compile.test.ts',
  'tests/compilation/trusted-compile.test.ts',
  'tests/transpilation/babel.test.ts',
  'tests/resolution/alias-resolver.test.ts',
  'tests/resolution/unified-resolver.test.ts',
  'tests/resolution/cache-invalidation.test.ts',
  'tests/services/ServiceRegistry.circular.test.ts',
  'tests/services/ServiceRegistry.subsystem.test.ts',
  'tests/shared/constant-parity.test.ts',
  'tests/shared/diagnostics-parity.test.ts',
  'tests/shared/duplicate-divergence.test.ts',
  'tests/shared/metadata-parity.test.ts',
  // real Comlink round-trip protects the blank-preview transport boundary
  'tests/shared/rpc-roundtrip.test.ts',
  'tests/shared/utility-parity.test.ts',
  'tests/extension/activate.unhandled-rejection.test.ts',
  'tests/extension/commands/security.test.ts',
  'tests/extension/commands/export.test.ts',
  'tests/extension/compiler/plugin-loader.test.ts',
  'tests/extension/config/CompilerConfig.test.ts',
  'tests/extension/config/ConfigResolver.test.ts',
  'tests/extension/config/TypeScriptConfigResolver.test.ts',
  'tests/extension/diagnostics/ComponentCodeActions.test.ts',
  'tests/extension/diagnostics/ComponentDetector.test.ts',
  'tests/extension/diagnostics/ComponentDiagnostics.test.ts',
  'tests/extension/language/MDXCompletionProvider.test.ts',
  'tests/extension/language/MDXOutlineProvider.test.ts',
  'tests/extension/language/MDXSymbolProvider.test.ts',
  'tests/extension/errors/ErrorReporter.test.ts',
  'tests/extension/preview/extension-rpc-handler.test.ts',
  'tests/extension/fetch/css-rewrite.test.ts',
  'tests/extension/fetch/fetch-local.test.ts',
  'tests/extension/fetch/sass-handler.test.ts',
  'tests/extension/transform/automatic-jsx-runtime.test.ts',
  'tests/extension/transform/import-extractor.test.ts',
  'tests/extension/framework/FrameworkDetector.test.ts',
  'tests/extension/module-system/fetchLocal.timeout.test.ts',
  'tests/extension/nextra/MetaResolver.test.ts',
  'tests/extension/preview/EvaluationEngine.timeout.test.ts',
  'tests/extension/preview/PreviewInitializer.test.ts',
  'tests/extension/preview/PreviewManager.test.ts',
  'tests/extension/preview/PreviewWebviewBridge.test.ts',
  'tests/extension/preview/evaluate-in-webview.test.ts',
  'tests/extension/preview/preview-update-flow.test.ts',
  'tests/extension/rpc-input-validation.test.ts',
  'tests/extension/security/checkFsPath.test.ts',
  'tests/extension/tailwind/TailwindDetector.test.ts',
  'tests/extension/tailwind/TailwindProcessor.test.ts',
  'tests/extension/tailwind/evaluation-engine-tailwind.test.ts',
  'tests/extension/themes/IconPackResolver.test.ts',
  'tests/extension/themes/iconPackValidation.test.ts',
  'tests/extension/workspace-events.test.ts',
  'tests/webview/App.test.ts',
  'tests/webview/export-html.test.ts',
  'tests/webview/ModuleRegistry.test.ts',
  'tests/webview/SafePreview.test.ts',
  'tests/webview/StyleInjector.test.ts',
  'tests/webview/TrustedPreview.test.ts',
  'tests/webview/module-runtime-compat.test.ts',
  'tests/webview/module-system-loader.test.ts',
  'tests/webview/preload-atomic-registration.test.ts',
  'tests/webview/preload-generation.test.ts',
  'tests/webview/safe-mode-processing.test.ts',
  'tests/webview/shimLoader.test.ts',
  'tests/webview/source-line-highlight.test.ts',
  'tests/webview/webview-rpc-client.test.ts',
  'tests/webview/mermaidIconPacks.test.ts',
]);

const CASE_COUNT_OVERRIDES = new Map([
  ['tests/extension/tailwind/TailwindProcessor.test.ts', 5],
  ['tests/extension/preview/evaluate-in-webview.test.ts', 5],
  ['tests/extension/diagnostics/ComponentDetector.test.ts', 11],
  ['tests/extension/diagnostics/ComponentDiagnostics.test.ts', 5],
  ['tests/resolution/unified-resolver.test.ts', 6],
  ['tests/shared/utility-parity.test.ts', 5],
  ['tests/extension/errors/ErrorReporter.test.ts', 5],
  ['tests/extension/language/MDXCompletionProvider.test.ts', 5],
  ['tests/extension/language/MDXSymbolProvider.test.ts', 9],
  ['tests/extension/rpc-input-validation.test.ts', 7],
  ['tests/extension/workspace-events.test.ts', 5],
  ['tests/webview/SafePreview.test.ts', 7],
  ['tests/webview/source-line-highlight.test.ts', 7],
  ['tests/extension/themes/iconPackValidation.test.ts', 5],
  ['tests/extension/themes/IconPackResolver.test.ts', 8],
]);

function isAllowedTestFile(repoPath) {
  if (EXACT_ALLOWED.has(repoPath)) {
    return true;
  }

  if (repoPath.startsWith('tests/security/') && repoPath.endsWith('.test.ts')) {
    return true;
  }

  if (
    repoPath.startsWith('tests/extension/handlers/') &&
    repoPath.endsWith('.test.ts')
  ) {
    return true;
  }

  return false;
}

function getMaxItBlocks(repoPath) {
  if (repoPath.startsWith('tests/security/') && repoPath.endsWith('.test.ts')) {
    return 6;
  }

  return CASE_COUNT_OVERRIDES.get(repoPath) ?? 4;
}

function countActiveItBlocks(contents) {
  return (contents.match(/^\s*it\(/gm) ?? []).length;
}

function countSkippedBlocks(contents) {
  return (contents.match(/^\s*(?:it|describe)\.skip\(/gm) ?? []).length;
}

const rootDir = process.cwd();
const testFiles = collectFiles({
  rootDir,
  startDir: path.join(rootDir, 'tests'),
  pathMode: 'relative',
  includeFile: (_absolutePath, entry) =>
    entry.isFile() && entry.name.endsWith('.test.ts'),
}).sort();
const errors = [];

for (const repoPath of testFiles) {
  if (!isAllowedTestFile(repoPath)) {
    errors.push(
      `[allowlist] ${repoPath} is outside the production-critical test allowlist`
    );
    continue;
  }

  const contents = fs.readFileSync(path.join(rootDir, repoPath), 'utf8');
  const skippedBlockCount = countSkippedBlocks(contents);
  const itBlockCount = countActiveItBlocks(contents);
  const maxItBlocks = getMaxItBlocks(repoPath);

  if (skippedBlockCount > 0) {
    errors.push(
      `[skips] ${repoPath} contains ${skippedBlockCount} skipped test block(s); remove out-of-policy cases instead of skipping them`
    );
  }

  if (itBlockCount > maxItBlocks) {
    errors.push(
      `[case-count] ${repoPath} has ${itBlockCount} active it() blocks (max ${maxItBlocks})`
    );
  }
}

if (errors.length > 0) {
  console.error('Test philosophy check failed');
  for (const error of errors) {
    console.error(error);
  }
  process.exit(1);
}

console.log(
  `Test philosophy check passed (${testFiles.length} files within allowlist & case-count caps)`
);
