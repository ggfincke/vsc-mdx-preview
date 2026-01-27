// packages/extension/module-system/deps/import-extractor.ts
// consolidated import/export specifier extraction from JavaScript/TypeScript code

import { init as initLexer, parse as parseImports } from 'es-module-lexer';
import { debug } from '../../logging';

// lexer initialization state
let lexerInitialized = false;

// ============================================================================
// I.4: Fast pre-check to skip parsing for files without imports
// Pattern matches: import statements, require() calls, export-from statements
// ============================================================================

const IMPORT_PATTERN =
  /\b(import\s|require\s*\(|export\s+\*\s+from|export\s+\{[^}]*\}\s+from)\b/;

// fast pre-check: returns true if code might have imports (worth parsing)
// returns false if definitely no imports (skip parsing for performance)
function mightHaveImports(code: string): boolean {
  return IMPORT_PATTERN.test(code);
}

// ensure es-module-lexer is initialized
async function ensureLexerInitialized(): Promise<void> {
  if (!lexerInitialized) {
    await initLexer;
    lexerInitialized = true;
  }
}

// commonJS require() extraction patterns
// LIMITATIONS: dynamic requires, computed paths, & template interpolation unsupported

// pattern 1: standard string quotes (single, double) w/ escaped char support
// matches: require('lodash'), require("express"), require('path\'s/file')
const REQUIRE_QUOTED = /require\s*\(\s*(['"])([^'"\\]*(?:\\.[^'"\\]*)*)\1\s*\)/g;

// pattern 2: template literals (simple, no interpolation)
// matches: require(`lodash`) but NOT require(`${dynamic}`)
const REQUIRE_TEMPLATE = /require\s*\(\s*`([^`\\]*(?:\\.[^`\\]*)*)`\s*\)/g;

// extract import specifiers from JavaScript/TypeScript code
// uses es-module-lexer for ESM imports, falls back to require() pattern for CJS
export async function extractImportSpecifiers(code: string): Promise<string[]> {
  // I.4: Fast path - skip parsing if no import-like patterns detected
  if (!mightHaveImports(code)) {
    debug('[IMPORT-EXTRACTOR] Fast path: no import patterns detected');
    return [];
  }

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

// extract CommonJS require() specifiers from code (fallback for pure CJS files)
function extractRequireSpecifiers(code: string): string[] {
  const specifiers: string[] = [];

  // reset lastIndex for global regexes (they maintain state between calls)
  REQUIRE_QUOTED.lastIndex = 0;
  REQUIRE_TEMPLATE.lastIndex = 0;

  // match quoted requires (single/double quotes w/ escaped char support)
  let match: RegExpExecArray | null;
  while ((match = REQUIRE_QUOTED.exec(code)) !== null) {
    const specifier = match[2];
    if (specifier && !specifiers.includes(specifier)) {
      specifiers.push(specifier);
    }
  }

  // match template literal requires (simple, no interpolation)
  while ((match = REQUIRE_TEMPLATE.exec(code)) !== null) {
    const specifier = match[1];
    // skip if contains ${} interpolation (can't statically analyze)
    if (specifier && !specifier.includes('${') && !specifiers.includes(specifier)) {
      specifiers.push(specifier);
    }
  }

  return specifiers;
}

// re-export for backward compatibility
export { extractImportSpecifiers as extractImports };
