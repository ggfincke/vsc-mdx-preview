// packages/extension/module-system/deps/import-extractor.ts
// consolidated import/export specifier extraction from JavaScript/TypeScript code

import { init as initLexer, parse as parseImports } from 'es-module-lexer';
import { debug } from '../../logging';

// lexer initialization state
let lexerInitialized = false;

// ensure es-module-lexer is initialized
async function ensureLexerInitialized(): Promise<void> {
  if (!lexerInitialized) {
    await initLexer;
    lexerInitialized = true;
  }
}

/**
 * CommonJS require() extraction patterns.
 *
 * LIMITATIONS (documented):
 * - Cannot extract dynamic requires: require(variable)
 * - Cannot extract computed requires: require('./dir/' + name)
 * - Template literal requires are partially supported (simple cases only)
 *
 * These limitations are acceptable because:
 * 1. es-module-lexer handles ESM imports correctly
 * 2. Dynamic requires can't be statically analyzed anyway
 * 3. Most modern code uses ESM syntax
 */

// Pattern 1: Standard string quotes (single, double) with escaped char support
// Matches: require('lodash'), require("express"), require('path\'s/file')
const REQUIRE_QUOTED = /require\s*\(\s*(['"])([^'"\\]*(?:\\.[^'"\\]*)*)\1\s*\)/g;

// Pattern 2: Template literals (simple, no interpolation)
// Matches: require(`lodash`) but NOT require(`${dynamic}`)
const REQUIRE_TEMPLATE = /require\s*\(\s*`([^`\\]*(?:\\.[^`\\]*)*)`\s*\)/g;

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

/**
 * Extract CommonJS require() specifiers from code.
 *
 * This is a FALLBACK for pure CommonJS files when es-module-lexer
 * finds no ESM imports. Static regex analysis has inherent limitations.
 *
 * @example Supported patterns:
 * - require('lodash')
 * - require("express")
 * - require(`simple-template`)
 * - require('path/with\'escaped/quotes')
 *
 * @example Unsupported patterns (cannot be statically analyzed):
 * - require(variable)
 * - require('./dir/' + name)
 * - require(`template-${interpolated}`)
 *
 * @param code - JavaScript/TypeScript source code
 * @returns Array of unique require specifier strings
 */
function extractRequireSpecifiers(code: string): string[] {
  const specifiers: string[] = [];

  // Reset lastIndex for global regexes (they maintain state between calls)
  REQUIRE_QUOTED.lastIndex = 0;
  REQUIRE_TEMPLATE.lastIndex = 0;

  // Match quoted requires (single/double quotes with escaped char support)
  let match: RegExpExecArray | null;
  while ((match = REQUIRE_QUOTED.exec(code)) !== null) {
    const specifier = match[2];
    if (specifier && !specifiers.includes(specifier)) {
      specifiers.push(specifier);
    }
  }

  // Match template literal requires (simple, no interpolation)
  while ((match = REQUIRE_TEMPLATE.exec(code)) !== null) {
    const specifier = match[1];
    // Skip if contains ${} interpolation (can't statically analyze)
    if (specifier && !specifier.includes('${') && !specifiers.includes(specifier)) {
      specifiers.push(specifier);
    }
  }

  return specifiers;
}

// re-export for backward compatibility
export { extractImportSpecifiers as extractImports };
