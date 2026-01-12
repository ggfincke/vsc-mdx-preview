// packages/extension/tailwind/TailwindScanner.ts
// extract Tailwind class candidates from MDX/JSX content
//
// error handling strategy:
// - extraction module - silent failures allow partial scans to succeed
// - Unreadable dependency files are skipped (logged at debug level)
// - Large files are skipped w/ debug log (not errors)
// - File resolution uses fallback chain: exact path → extensions → index files

import * as fs from 'fs';
import * as path from 'path';
import { debug } from '../logging';
import {
  isLocalImport,
  resolveImportAsync,
} from '../module-fetcher/resolve-import';
import { SCANNER_MAX_RECURSION_DEPTH } from './constants';

// static class attribute: className="..." or class='...'
const CLASS_ATTR_RE = /\bclass(Name)?\s*=\s*("([^"]*)"|'([^']*)')/g;
// pattern to find the start of a className/class expression: className={
const CLASS_EXPR_START_RE = /\bclass(Name)?\s*=\s*\{/g;
// pattern to find clsx/cn/classnames function calls
const CLSX_START_RE = /\b(?:clsx|cn|classnames)\s*\(/g;
// pattern to find array.join(' ') or array.join(" ") patterns
const ARRAY_JOIN_RE = /\[\s*([^\]]*)\]\s*\.\s*join\s*\(\s*['"][\s]*['"]\s*\)/g;
// pattern to find cva() (class-variance-authority) function calls
const CVA_START_RE = /\bcva\s*\(/g;
// @apply directives in CSS
const APPLY_RE = /@apply\s+([^;]+);/g;
// @layer utilities/components blocks - extract custom class definitions
const LAYER_RE = /@layer\s+(?:utilities|components)\s*\{/g;
// CSS class selector pattern (matches .class-name in CSS)
const CSS_CLASS_SELECTOR_RE = /\.([A-Za-z_-][A-Za-z0-9_-]*)/g;
// valid Tailwind class token pattern
const CLASS_TOKEN_RE = /^[A-Za-z0-9:_/.\-[\]()%,#=!]+$/;

export interface TailwindScanOptions {
  includeDependencies: boolean;
  entryFilePath?: string;
  entryFileDependencies?: string[];
  maxFileSizeBytes?: number;
}

export interface TailwindScanResult {
  classList: string[];
  scannedFiles: string[];
}

// extracts Tailwind class candidates from MDX/JSX/TSX content
// supported patterns:
// - static attributes: className="..." or class='...'
// - dynamic expressions: className={...} w/ ternaries, template literals
// - utility functions: clsx(), cn(), classnames()
// - CVA (class-variance-authority): cva('base', { variants: {...} })
// - array join: ['flex', 'gap-4'].join(' ')
// - @apply directives in CSS
// unsupported patterns (use Tailwind's safelist for these):
// - string concatenation: "flex " + "items-center"
// - truly dynamic classes: `text-${size}`, className={styles[variant]}
// - computed property keys: { [dynamicKey]: true }
export class TailwindScanner {
  async scan(
    text: string,
    options: TailwindScanOptions
  ): Promise<TailwindScanResult> {
    const classSet = new Set<string>();
    const scannedFiles: string[] = [];

    // extract from main text (synchronous - no I/O)
    this.extractFromText(text, classSet);

    if (
      options.includeDependencies &&
      options.entryFilePath &&
      options.entryFileDependencies &&
      options.entryFileDependencies.length > 0
    ) {
      const resolved = await this.resolveDependencies(
        options.entryFilePath,
        options.entryFileDependencies
      );

      const sizeLimit = options.maxFileSizeBytes ?? 1024 * 1024;

      // read all dependency files in parallel
      const fileReadPromises = resolved.map(
        async (
          fsPath
        ): Promise<{
          fsPath: string;
          content: string | null;
        }> => {
          try {
            const stat = await fs.promises.stat(fsPath);
            if (stat.size > sizeLimit) {
              debug(`[TAILWIND] Skipping large file: ${fsPath}`);
              return { fsPath, content: null };
            }
            const content = await fs.promises.readFile(fsPath, 'utf-8');
            return { fsPath, content };
          } catch (err) {
            debug(
              `[TAILWIND] Skipping unreadable dependency: ${fsPath} (${err instanceof Error ? err.message : String(err)})`
            );
            return { fsPath, content: null };
          }
        }
      );

      const fileResults = await Promise.all(fileReadPromises);

      for (const { fsPath, content } of fileResults) {
        if (content !== null) {
          this.extractFromText(content, classSet);
          scannedFiles.push(fsPath);
        }
      }
    }

    return {
      classList: Array.from(classSet).sort(),
      scannedFiles: scannedFiles.sort(),
    };
  }

  private extractFromText(text: string, classSet: Set<string>): void {
    // extract from static className/class attributes
    for (const match of text.matchAll(CLASS_ATTR_RE)) {
      const raw = match[3] ?? match[4] ?? '';
      this.addClasses(raw, classSet);
    }

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

    // extract from clsx/cn/classnames(...) calls using paren matching
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

    // extract from array.join(' ') patterns: ['flex', 'gap-4'].join(' ')
    this.extractArrayJoinPatterns(text, classSet);

    // extract from cva() (class-variance-authority) calls
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

    // extract from @apply directives
    for (const match of text.matchAll(APPLY_RE)) {
      const raw = match[1] ?? '';
      this.addClasses(raw, classSet);
    }

    // extract custom class definitions from @layer utilities/components blocks
    this.extractLayerClasses(text, classSet);
  }

  // extract custom class names defined in @layer utilities/components blocks
  // example: @layer utilities { .custom-gradient { ... } }
  // extracts: "custom-gradient"
  private extractLayerClasses(text: string, classSet: Set<string>): void {
    for (const layerContent of this.extractBracedExpressions(
      text,
      LAYER_RE,
      '{',
      '}'
    )) {
      // extract all CSS class selectors from within the @layer block
      for (const match of layerContent.matchAll(CSS_CLASS_SELECTOR_RE)) {
        const className = match[1];
        if (className && CLASS_TOKEN_RE.test(className)) {
          classSet.add(className);
        }
      }
    }
  }

  // extract balanced expressions using brace/paren matching
  // this handles nested braces properly, e.g., className={condition ? "a" : "b"}
  // where the simple regex would fail at the first }
  private extractBracedExpressions(
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

  // extract content between balanced open/close characters
  // handles nested structures & respects string literals
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
      // e.g., \\ = escaped backslash, \\\" = escaped backslash + escaped quote
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
          // Note: We should also track strings inside the interpolation,
          // but for class extraction purposes, this simpler approach works
          // since we recursively process the expression content anyway
        }
      }

      // Only count braces for the outer expression when completely outside all strings
      // This includes being outside single quotes, double quotes, AND template strings
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

  private addClasses(raw: string, classSet: Set<string>): void {
    const tokens = raw.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      if (CLASS_TOKEN_RE.test(token)) {
        classSet.add(token);
      }
    }
  }

  // check if a character at the given index is escaped
  // counts consecutive backslashes before the character - odd count means escaped
  // examples:
  // - \"  -> quote is escaped (1 backslash)
  // - \\" -> quote is NOT escaped (2 backslashes escape each other)
  // - \\\" -> quote is escaped (3 backslashes: 2 escape each other, 1 escapes quote)
  private isEscaped(text: string, index: number): boolean {
    let backslashCount = 0;
    let j = index - 1;
    while (j >= 0 && text[j] === '\\') {
      backslashCount++;
      j--;
    }
    return backslashCount % 2 === 1;
  }

  // extract classes from array.join(' ') patterns
  // example: ['flex', 'gap-4', condition && 'mt-2'].join(' ')
  private extractArrayJoinPatterns(text: string, classSet: Set<string>): void {
    for (const match of text.matchAll(ARRAY_JOIN_RE)) {
      const arrayContent = match[1];
      // Extract string literals from inside the array brackets
      const literals = this.extractStringLiterals(`[${arrayContent}]`);
      for (const literal of literals) {
        this.addClasses(literal, classSet);
      }
    }
  }

  // extract string literals from a JavaScript expression
  // recursively extracts from template literal interpolations to capture
  // classes like: `flex ${condition ? "text-sm" : "text-lg"} gap-2`
  // LIMITATION: truly dynamic classes like `text-${size}` cannot be extracted
  // statically. Use Tailwind's `safelist` configuration for these cases
  // expression: JavaScript expression to extract from
  // depth: current recursion depth (default 0, max MAX_RECURSION_DEPTH)
  private extractStringLiterals(expression: string, depth = 0): string[] {
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

    // extract template literals w/ recursive interpolation handling
    for (const match of expression.matchAll(/`([^`\\]*(?:\\.[^`\\]*)*)`/g)) {
      const template = match[1];
      this.extractFromTemplateLiteral(template, results, depth);
    }

    return results;
  }

  // extract classes from a template literal, including from ${} interpolations
  // example: `flex ${condition ? "text-sm" : "text-lg"} gap-2`
  // extracts: "flex ", "text-sm", "text-lg", " gap-2"
  // template: template literal content (w/o backticks)
  // results: array to push extracted classes into
  // recursionDepth: current recursion depth for stack overflow protection
  private extractFromTemplateLiteral(
    template: string,
    results: string[],
    recursionDepth: number
  ): void {
    // use a more sophisticated approach to find interpolations
    // pattern matches ${...} including nested braces
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

          // recursively extract string literals from the expression (w/ incremented depth)
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

  private async resolveDependencies(
    entryFilePath: string,
    imports: string[]
  ): Promise<string[]> {
    const entryDir = path.dirname(entryFilePath);

    // filter to relative imports only & resolve in parallel using shared utility
    const resolutionPromises = imports
      .filter(isLocalImport)
      .map((specifier) => resolveImportAsync(entryDir, specifier));

    const results = await Promise.all(resolutionPromises);
    return results.filter((target): target is string => target !== null);
  }
}
