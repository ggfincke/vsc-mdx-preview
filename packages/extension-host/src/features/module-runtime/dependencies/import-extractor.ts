// packages/extension-host/src/features/module-runtime/dependencies/import-extractor.ts
// consolidated import/export specifier extraction from JavaScript/TypeScript code

import { init as initLexer, parse as parseImports } from 'es-module-lexer';
import { LogTags } from '@mdx-preview/contracts';
import { extractErrorMessage } from '@mdx-preview/runtime-utils';
import { createTaggedLogger } from '../../../shared/logging/logger';

// module-level tagged logger for import extraction
const log = createTaggedLogger(LogTags.IMPORT_EXTRACTOR);

// lexer initialization state
let lexerInitialized = false;

// I.4: fast pre-check to skip parsing for files w/o imports
// pattern matches: import statements (all forms), require() calls, export-from statements
// biased toward false positives - es-module-lexer handles actual parsing

const IMPORT_PATTERN =
  /\b(import\s|import\s*\(|require\s*\(|export\s+[*{]|export\s+type\s+\{|from\s+['"`])/;

// fast pre-check: return true if code might have imports (worth parsing)
// return false if definitely no imports (skip parsing for performance)
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

// detect dynamic imports whose specifiers can be resolved before evaluation
export async function hasLiteralDynamicImport(code: string): Promise<boolean> {
  if (!IMPORT_PATTERN.test(code)) {
    return false;
  }

  await ensureLexerInitialized();
  try {
    const [imports] = parseImports(code);
    return imports.some(
      (imported) =>
        imported.d >= 0 && imported.n !== undefined && imported.n !== null
    );
  } catch {
    return false;
  }
}

interface LocatedSpecifier {
  index: number;
  specifier: string;
}

// extract import specifiers from JavaScript/TypeScript code
// use es-module-lexer for ESM imports & a token scanner for CommonJS requires
export async function extractImportSpecifiers(code: string): Promise<string[]> {
  // I.4: fast path - skip parsing if no import-like patterns detected
  if (!mightHaveImports(code)) {
    log.debug('fast path: no import patterns detected');
    return [];
  }

  await ensureLexerInitialized();

  try {
    const [imports] = parseImports(code);

    // extract ESM & CJS specifiers in source order
    const esmImports: LocatedSpecifier[] = [];
    for (const imported of imports) {
      if (imported.n !== undefined && imported.n !== null) {
        esmImports.push({ index: imported.ss, specifier: imported.n });
      }
    }
    return dedupeLocatedSpecifiers([
      ...esmImports,
      ...extractRequireSpecifiers(code),
    ]);
  } catch (error: unknown) {
    log.debug(
      `Lexer error, falling back to require: ${extractErrorMessage(error)}`
    );
    return dedupeLocatedSpecifiers(extractRequireSpecifiers(code));
  }
}

// order all syntax forms together & keep the first occurrence
function dedupeLocatedSpecifiers(
  locatedSpecifiers: LocatedSpecifier[]
): string[] {
  locatedSpecifiers.sort((left, right) => left.index - right.index);
  return [...new Set(locatedSpecifiers.map(({ specifier }) => specifier))];
}

// skip a quoted JavaScript value while respecting escape sequences
function findQuoteEnd(code: string, start: number, quote: string): number {
  for (let index = start + 1; index < code.length; index += 1) {
    if (code[index] === '\\') {
      index += 1;
    } else if (code[index] === quote) {
      return index;
    }
  }
  return -1;
}

// extract static bare require() calls while ignoring comments & string contents
function extractRequireSpecifiers(code: string): LocatedSpecifier[] {
  const specifiers: LocatedSpecifier[] = [];

  for (let index = 0; index < code.length; index += 1) {
    const char = code[index];
    const nextChar = code[index + 1];

    if (char === '/' && nextChar === '/') {
      index = code.indexOf('\n', index + 2);
      if (index === -1) {
        break;
      }
      continue;
    }

    if (char === '/' && nextChar === '*') {
      const commentEnd = code.indexOf('*/', index + 2);
      if (commentEnd === -1) {
        break;
      }
      index = commentEnd + 1;
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      const quoteEnd = findQuoteEnd(code, index, char);
      if (quoteEnd === -1) {
        break;
      }
      index = quoteEnd;
      continue;
    }

    if (
      !code.startsWith('require', index) ||
      /[\w$.]/.test(code[index - 1] ?? '') ||
      /[\w$]/.test(code[index + 7] ?? '')
    ) {
      continue;
    }

    let cursor = index + 7;
    while (/\s/.test(code[cursor] ?? '')) {
      cursor += 1;
    }
    if (code[cursor] !== '(') {
      continue;
    }

    cursor += 1;
    while (/\s/.test(code[cursor] ?? '')) {
      cursor += 1;
    }
    const quote = code[cursor];
    if (quote !== "'" && quote !== '"' && quote !== '`') {
      continue;
    }

    const quoteEnd = findQuoteEnd(code, cursor, quote);
    if (quoteEnd === -1) {
      break;
    }
    const specifier = code.slice(cursor + 1, quoteEnd);
    cursor = quoteEnd + 1;
    while (/\s/.test(code[cursor] ?? '')) {
      cursor += 1;
    }

    if (
      code[cursor] === ')' &&
      specifier &&
      (quote !== '`' || !specifier.includes('${'))
    ) {
      specifiers.push({ index, specifier });
    }
    index = quoteEnd;
  }

  return specifiers;
}
