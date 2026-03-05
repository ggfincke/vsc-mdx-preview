// packages/extension-host/src/features/tailwind/scanning/parser-utils.ts
// pure parsing utilities for extracting balanced expressions & string literals

import { createTaggedLogger } from '../../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import { SCANNER_MAX_RECURSION_DEPTH } from '../constants';

const log = createTaggedLogger(LogTags.TAILWIND_SCAN);

// check if character is escaped by counting consecutive backslashes (odd count = escaped)
export function isEscaped(text: string, index: number): boolean {
  let backslashCount = 0;
  let j = index - 1;
  while (j >= 0 && text[j] === '\\') {
    backslashCount++;
    j--;
  }
  return backslashCount % 2 === 1;
}

// extract content between balanced open/close characters w/ nested structure handling
export function extractBalanced(
  text: string,
  startIndex: number,
  openChar: string,
  closeChar: string
): string | null {
  let depth = 1;
  let i = startIndex;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplateString = false;
  // track brace depth within ${} interpolations
  let templateExprDepth = 0;

  while (i < text.length && depth > 0) {
    const char = text[i];

    // handle escape sequences properly - count consecutive backslashes
    // odd number of backslashes means the current char is escaped
    if (isEscaped(text, i)) {
      i++;
      continue;
    }

    // track string state (only when not inside a template expression)
    if (templateExprDepth === 0) {
      if (char === "'" && !inDoubleQuote && !inTemplateString) {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && !inSingleQuote && !inTemplateString) {
        inDoubleQuote = !inDoubleQuote;
      } else if (char === '`' && !inSingleQuote && !inDoubleQuote) {
        inTemplateString = !inTemplateString;
      }
    }

    // track template expression ${} - must track nested braces within
    if (inTemplateString && !inSingleQuote && !inDoubleQuote) {
      if (char === '$' && text[i + 1] === '{') {
        templateExprDepth = 1;
        // skip ${ entirely
        i += 2;
        continue;
      } else if (templateExprDepth > 0) {
        // inside template expression - track inner string states & braces
        if (char === '{') {
          templateExprDepth++;
        } else if (char === '}') {
          templateExprDepth--;
          // when depth reaches 0, we've exited the interpolation
        }
      }
    }

    // only count braces for the outer expression when completely outside all strings
    const outsideAllStrings =
      !inSingleQuote && !inDoubleQuote && !inTemplateString;

    if (outsideAllStrings) {
      if (char === openChar) {
        depth++;
      } else if (char === closeChar) {
        depth--;
      }
    }

    i++;
  }

  if (depth === 0) {
    // return content excluding the final closing brace
    return text.slice(startIndex, i - 1);
  }

  return null;
}

// extract balanced expressions using brace/paren matching & handle nested braces properly
export function extractBracedExpressions(
  text: string,
  startPattern: RegExp,
  openChar: string,
  closeChar: string
): string[] {
  const results: string[] = [];
  // reset regex state
  const pattern = new RegExp(startPattern.source, startPattern.flags);

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const startIndex = match.index + match[0].length;
    const extracted = extractBalanced(text, startIndex, openChar, closeChar);
    if (extracted !== null) {
      results.push(extracted);
    }
  }

  return results;
}

// extract classes from template literal including ${} interpolations
export function extractFromTemplateLiteral(
  template: string,
  results: string[],
  recursionDepth: number
): void {
  let i = 0;
  let staticStart = 0;

  while (i < template.length) {
    // look for ${
    if (template[i] === '$' && template[i + 1] === '{') {
      // add static part before this interpolation
      const staticPart = template.slice(staticStart, i);
      if (staticPart.trim()) {
        results.push(staticPart);
      }

      // find the matching closing brace
      // skip ${
      i += 2;
      const exprStart = i;
      let braceDepth = 1;
      let inString: string | null = null;

      while (i < template.length && braceDepth > 0) {
        const char = template[i];

        // handle escape sequences - use robust backslash counting
        if (isEscaped(template, i)) {
          i++;
          continue;
        }

        // track string state
        if (!inString && (char === '"' || char === "'" || char === '`')) {
          inString = char;
        } else if (inString === char) {
          inString = null;
        } else if (!inString) {
          if (char === '{') {
            braceDepth++;
          } else if (char === '}') {
            braceDepth--;
          }
        }

        i++;
      }

      if (braceDepth === 0) {
        // extract the expression content (excluding closing brace)
        const expr = template.slice(exprStart, i - 1);

        // recursively extract string literals from the expression
        const nestedLiterals = extractStringLiterals(
          expr,
          recursionDepth + 1
        );
        results.push(...nestedLiterals);

        staticStart = i;
      }
    } else {
      i++;
    }
  }

  // add remaining static part
  const remainingStatic = template.slice(staticStart);
  if (remainingStatic.trim()) {
    results.push(remainingStatic);
  }
}

// extract string literals from JavaScript expression w/ recursive template literal handling
export function extractStringLiterals(
  expression: string,
  depth = 0
): string[] {
  // guard against stack overflow from pathological nested template literals
  if (depth > SCANNER_MAX_RECURSION_DEPTH) {
    log.debug(
      `Max recursion depth (${SCANNER_MAX_RECURSION_DEPTH}) reached, skipping nested extraction`
    );
    return [];
  }

  const results: string[] = [];

  // extract single-quoted strings
  for (const match of expression.matchAll(/'([^'\\]*(?:\\.[^'\\]*)*)'/g)) {
    results.push(match[1].replace(/\\'/g, "'"));
  }

  // extract double-quoted strings
  for (const match of expression.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)) {
    results.push(match[1].replace(/\\"/g, '"'));
  }

  // extract template literals w/ recursive interpolation handling
  for (const match of expression.matchAll(/`([^`\\]*(?:\\.[^`\\]*)*)`/g)) {
    const template = match[1];
    extractFromTemplateLiteral(template, results, depth);
  }

  return results;
}
