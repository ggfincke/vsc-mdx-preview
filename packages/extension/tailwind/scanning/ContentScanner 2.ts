// packages/extension/tailwind/scanning/ContentScanner.ts
// extract Tailwind classes from dynamic expressions (className={...}, clsx(), cva())

import { debug } from '../../logging';
import { CLASS_TOKEN_RE, SCANNER_MAX_RECURSION_DEPTH } from '../constants';

// pattern to find the start of a className/class expression: className={
const CLASS_EXPR_START_RE = /\bclass(Name)?\s*=\s*\{/g;

// pattern to find clsx/cn/classnames function calls
const CLSX_START_RE = /\b(?:clsx|cn|classnames)\s*\(/g;

// pattern to find array.join(' ') or array.join(" ") patterns
const ARRAY_JOIN_RE = /\[\s*([^\]]*)\]\s*\.\s*join\s*\(\s*['"][\s]*['"]\s*\)/g;

// pattern to find cva() (class-variance-authority) function calls
const CVA_START_RE = /\bcva\s*\(/g;

// extracts Tailwind classes from dynamic expressions (className={...}, clsx(), cva(), array.join())
export class ContentScanner {
  // extract classes from className={...} expressions
  extractDynamicExpressions(text: string, classSet: Set<string>): void {
    // extract from className={...} expressions using brace matching
    for (const expr of this.extractBracedExpressions(
      text,
      CLASS_EXPR_START_RE,
      '{',
      '}'
    )) {
      const literals = this.extractStringLiterals(expr);
      for (const literal of literals) {
        this.addClasses(literal, classSet);
      }
    }
  }

  // extract classes from clsx/cn/classnames(...) calls
  extractUtilityFunctions(text: string, classSet: Set<string>): void {
    for (const expr of this.extractBracedExpressions(
      text,
      CLSX_START_RE,
      '(',
      ')'
    )) {
      const literals = this.extractStringLiterals(expr);
      for (const literal of literals) {
        this.addClasses(literal, classSet);
      }
    }
  }

  // extract classes from cva() (class-variance-authority) calls
  extractCvaPatterns(text: string, classSet: Set<string>): void {
    for (const expr of this.extractBracedExpressions(
      text,
      CVA_START_RE,
      '(',
      ')'
    )) {
      const literals = this.extractStringLiterals(expr);
      for (const literal of literals) {
        this.addClasses(literal, classSet);
      }
    }
  }

  // extract classes from array.join(' ') patterns
  // Example: ['flex', 'gap-4', condition && 'mt-2'].join(' ')
  extractArrayJoinPatterns(text: string, classSet: Set<string>): void {
    for (const match of text.matchAll(ARRAY_JOIN_RE)) {
      const arrayContent = match[1];
      // Extract string literals from inside the array brackets
      const literals = this.extractStringLiterals(`[${arrayContent}]`);
      for (const literal of literals) {
        this.addClasses(literal, classSet);
      }
    }
  }

  // extract balanced expressions using brace/paren matching
  // Handles nested braces properly, e.g., className={condition ? "a" : "b"}
  extractBracedExpressions(
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
      const extracted = this.extractBalanced(
        text,
        startIndex,
        openChar,
        closeChar
      );
      if (extracted !== null) {
        results.push(extracted);
      }
    }

    return results;
  }

  // extract content between balanced open/close characters w/ nested structure handling
  private extractBalanced(
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
    let templateExprDepth = 0; // Track brace depth within ${} interpolations

    while (i < text.length && depth > 0) {
      const char = text[i];

      // handle escape sequences properly - count consecutive backslashes
      // odd number of backslashes means the current char is escaped
      if (this.isEscaped(text, i)) {
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
          i += 2; // Skip ${ entirely
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

      // Only count braces for the outer expression when completely outside all strings
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

  // extract string literals from JavaScript expression w/ recursive template literal handling
  extractStringLiterals(expression: string, depth = 0): string[] {
    // Guard against stack overflow from pathological nested template literals
    if (depth > SCANNER_MAX_RECURSION_DEPTH) {
      debug(
        `[TAILWIND-SCANNER] Max recursion depth (${SCANNER_MAX_RECURSION_DEPTH}) reached, skipping nested extraction`
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

    // extract template literals with recursive interpolation handling
    for (const match of expression.matchAll(/`([^`\\]*(?:\\.[^`\\]*)*)`/g)) {
      const template = match[1];
      this.extractFromTemplateLiteral(template, results, depth);
    }

    return results;
  }

  // extract classes from template literal including ${} interpolations
  private extractFromTemplateLiteral(
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
        i += 2; // Skip ${
        const exprStart = i;
        let braceDepth = 1;
        let inString: string | null = null;

        while (i < template.length && braceDepth > 0) {
          const char = template[i];
          const prevChar = i > 0 ? template[i - 1] : '';

          // handle escape sequences
          if (prevChar === '\\') {
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
          const nestedLiterals = this.extractStringLiterals(
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

    // Add remaining static part
    const remainingStatic = template.slice(staticStart);
    if (remainingStatic.trim()) {
      results.push(remainingStatic);
    }
  }

  // check if character is escaped by counting consecutive backslashes (odd count = escaped)
  private isEscaped(text: string, index: number): boolean {
    let backslashCount = 0;
    let j = index - 1;
    while (j >= 0 && text[j] === '\\') {
      backslashCount++;
      j--;
    }
    return backslashCount % 2 === 1;
  }

  // add space-separated class tokens to the set
  private addClasses(raw: string, classSet: Set<string>): void {
    const tokens = raw.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      if (CLASS_TOKEN_RE.test(token)) {
        classSet.add(token);
      }
    }
  }
}
