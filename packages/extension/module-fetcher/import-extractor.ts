// packages/extension/module-fetcher/import-extractor.ts
// consolidated import/export specifier extraction from JavaScript/TypeScript code

import { init as initLexer, parse as parseImports } from 'es-module-lexer';
import { debug } from '../logging';

// lexer initialization state
let lexerInitialized = false;

// ensure es-module-lexer is initialized
async function ensureLexerInitialized(): Promise<void> {
  if (!lexerInitialized) {
    await initLexer;
    lexerInitialized = true;
  }
}

// CommonJS require pattern for fallback extraction
const REQUIRE_PATTERN = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

// extract import specifiers from JavaScript/TypeScript code
// uses es-module-lexer for ESM imports, falls back to require() pattern for CJS
export async function extractImportSpecifiers(code: string): Promise<string[]> {
  await ensureLexerInitialized();

  try {
    const [imports] = parseImports(code);

    // extract import specifiers (module names)
    const esmImports = imports
      .map((imp) => imp.n)
      .filter((name): name is string => name !== undefined && name !== null);

    // if no ESM imports found, try CommonJS
    if (esmImports.length === 0) {
      return extractRequireSpecifiers(code);
    }

    return esmImports;
  } catch (error) {
    debug(`[IMPORT-EXTRACTOR] Lexer error, falling back to require: ${error}`);
    return extractRequireSpecifiers(code);
  }
}

// extract require() specifiers from CommonJS code
export function extractRequireSpecifiers(code: string): string[] {
  const matches = code.matchAll(REQUIRE_PATTERN);
  return Array.from(matches, (m) => m[1]);
}

// check if a specifier is a local/relative import
// returns true for './foo' & '../bar', false for bare specifiers & URLs
export function isLocalImport(specifier: string): boolean {
  if (!specifier) return false;
  if (specifier.startsWith('http://') || specifier.startsWith('https://'))
    return false;
  if (specifier.startsWith('npm://')) return false;
  return specifier.startsWith('./') || specifier.startsWith('../');
}

// check if a specifier should be resolved (not a URL or special protocol)
export function shouldResolve(specifier: string): boolean {
  if (!specifier) return false;
  if (specifier.startsWith('http://') || specifier.startsWith('https://'))
    return false;
  if (specifier.startsWith('npm://')) return false;
  return true;
}

// check if a specifier is a bare import (not relative, not URL)
export function isBareImport(specifier: string): boolean {
  return shouldResolve(specifier) && !isLocalImport(specifier);
}

// re-export for backward compatibility
export { extractImportSpecifiers as extractImports };
