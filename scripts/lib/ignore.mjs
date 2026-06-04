// scripts/lib/ignore.mjs
// canonical directory ignore set shared by guardrail scripts

export const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.vscode-test',
  'archive',
  'build',
  'coverage',
  'dev-docs',
  'dist',
  'node_modules',
]);
