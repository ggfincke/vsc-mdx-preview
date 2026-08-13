// packages/extension-host/src/features/module-runtime/handlers/result-builders.ts
// builder functions for constructing FetchResult objects consistently

import * as path from 'path';
import type { FetchResult } from '@mdx-preview/contracts';
import type {
  FileTypeHandler,
  FileTypeHandlerResult,
  ModuleExecutionContext,
} from '../types/handlers';

interface CssReplacement {
  end: number;
  start: number;
  value: string;
}

// find the closing quote while tolerating CSS escape sequences
function findCssQuoteEnd(css: string, start: number): number {
  const quote = css[start];
  for (let index = start + 1; index < css.length; index += 1) {
    if (css[index] === '\\') {
      index += 1;
    } else if (css[index] === quote) {
      return index;
    }
  }
  return -1;
}

// advance across whitespace & comments between CSS tokens
function skipCssTrivia(css: string, start: number): number {
  let index = start;
  while (index < css.length) {
    if (/\s/.test(css[index])) {
      index += 1;
      continue;
    }
    if (css.startsWith('/*', index)) {
      const commentEnd = css.indexOf('*/', index + 2);
      return commentEnd === -1
        ? css.length
        : skipCssTrivia(css, commentEnd + 2);
    }
    break;
  }
  return index;
}

// find the end of the CSS identifier beginning at start
function findCssIdentifierEnd(css: string, start: number): number {
  let index = start;
  while (/[a-z-]/i.test(css[index] ?? '')) {
    index += 1;
  }
  return index;
}

// convert one relative CSS reference to a stylesheet-relative webview URI
function rewriteCssReference(
  reference: string,
  fsPath: string,
  context: ModuleExecutionContext
): string {
  if (
    !reference ||
    reference.startsWith('#') ||
    reference.startsWith('//') ||
    path.isAbsolute(reference) ||
    /^[a-z][a-z\d+.-]*:/i.test(reference) ||
    /^[a-z-]+\(/i.test(reference)
  ) {
    return reference;
  }

  const suffixStart = reference.search(/[?#]/);
  const resourcePath =
    suffixStart === -1 ? reference : reference.slice(0, suffixStart);
  const suffix = suffixStart === -1 ? '' : reference.slice(suffixStart);
  const resolvedPath = path.resolve(path.dirname(fsPath), resourcePath);
  const webviewUri = context.getWebviewUri(resolvedPath);
  return webviewUri ? `${webviewUri}${suffix}` : reference;
}

// locate url() tokens & direct quoted @import targets outside strings/comments
function collectCssReplacements(css: string): CssReplacement[] {
  const replacements: CssReplacement[] = [];

  for (let index = 0; index < css.length; index += 1) {
    if (css.startsWith('/*', index)) {
      const commentEnd = css.indexOf('*/', index + 2);
      if (commentEnd === -1) {
        break;
      }
      index = commentEnd + 1;
      continue;
    }

    if (css[index] === "'" || css[index] === '"') {
      const quoteEnd = findCssQuoteEnd(css, index);
      if (quoteEnd === -1) {
        break;
      }
      index = quoteEnd;
      continue;
    }

    if (css[index] === '@') {
      const nameEnd = findCssIdentifierEnd(css, index + 1);
      if (css.slice(index + 1, nameEnd).toLowerCase() === 'import') {
        const valueStart = skipCssTrivia(css, nameEnd);
        if (css[valueStart] === "'" || css[valueStart] === '"') {
          const quoteEnd = findCssQuoteEnd(css, valueStart);
          if (quoteEnd !== -1) {
            replacements.push({
              start: valueStart + 1,
              end: quoteEnd,
              value: css.slice(valueStart + 1, quoteEnd),
            });
            index = quoteEnd;
          }
        }
      }
      continue;
    }

    const nameEnd = findCssIdentifierEnd(css, index);
    if (nameEnd === index) {
      continue;
    }
    if (css.slice(index, nameEnd).toLowerCase() !== 'url') {
      index = nameEnd - 1;
      continue;
    }

    const openParen = skipCssTrivia(css, nameEnd);
    if (css[openParen] !== '(') {
      continue;
    }
    let valueStart = skipCssTrivia(css, openParen + 1);
    let valueEnd: number;

    if (css[valueStart] === "'" || css[valueStart] === '"') {
      valueEnd = findCssQuoteEnd(css, valueStart);
      if (valueEnd === -1) {
        break;
      }
      valueStart += 1;
    } else {
      let depth = 0;
      valueEnd = valueStart;
      for (; valueEnd < css.length; valueEnd += 1) {
        if (css[valueEnd] === '\\') {
          valueEnd += 1;
        } else if (css[valueEnd] === '(') {
          depth += 1;
        } else if (css[valueEnd] === ')' && depth > 0) {
          depth -= 1;
        } else if (css[valueEnd] === ')') {
          break;
        }
      }
      while (valueEnd > valueStart && /\s/.test(css[valueEnd - 1])) {
        valueEnd -= 1;
      }
    }

    replacements.push({
      start: valueStart,
      end: valueEnd,
      value: css.slice(valueStart, valueEnd),
    });
    index = valueEnd;
  }

  return replacements;
}

// rewrite stylesheet-relative references without touching CSS string contents
function rewriteCssReferences(
  css: string,
  fsPath: string,
  context: ModuleExecutionContext
): string {
  const replacements = collectCssReplacements(css);
  let rewritten = '';
  let cursor = 0;

  for (const replacement of replacements) {
    rewritten +=
      css.slice(cursor, replacement.start) +
      rewriteCssReference(replacement.value, fsPath, context);
    cursor = replacement.end;
  }

  return rewritten + css.slice(cursor);
}

// build a FetchResult for CSS content (no JavaScript code)
export function buildCssResult(
  fsPath: string,
  css: string,
  context?: ModuleExecutionContext,
  watchFiles?: string[]
): FileTypeHandlerResult {
  return {
    fsPath,
    css: context ? rewriteCssReferences(css, fsPath, context) : css,
    code: '',
    dependencies: [],
    ...(watchFiles !== undefined ? { watchFiles } : {}),
  };
}

// build a FetchResult for a CommonJS module export (JSON & image files)
export function buildModuleExportResult(
  fsPath: string,
  exportValue: string
): FetchResult {
  return {
    fsPath,
    code: `module.exports = ${exportValue}`,
    dependencies: [],
  };
}

// build a FetchResult for transpiled script code w/ dependencies
export function buildScriptResult(
  fsPath: string,
  code: string,
  dependencies: FetchResult['dependencies']
): FetchResult {
  return {
    fsPath,
    code,
    dependencies,
  };
}

// create a simple handler that delegates directly to a builder function
export function createSimpleHandler(
  extensions: readonly string[],
  builderFn: (
    fsPath: string,
    code: string,
    context: ModuleExecutionContext
  ) => FetchResult
): FileTypeHandler {
  return {
    extensions: [...extensions],
    async handle(
      code: string,
      fsPath: string,
      context: ModuleExecutionContext
    ): Promise<FetchResult> {
      return builderFn(fsPath, code, context);
    },
  };
}
