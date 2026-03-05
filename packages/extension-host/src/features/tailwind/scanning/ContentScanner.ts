// packages/extension-host/src/features/tailwind/scanning/ContentScanner.ts
// extract Tailwind classes from dynamic expressions (className={...}, clsx(), cva())

import { addClasses } from './utils';
import {
  extractBracedExpressions as extractBraced,
  extractStringLiterals as extractLiterals,
} from './parser-utils';

// pattern to find the start of a className/class expression: className={
const CLASS_EXPR_START_RE = /\bclass(Name)?\s*=\s*\{/g;

// pattern to find clsx/cn/classnames function calls
const CLSX_START_RE = /\b(?:clsx|cn|classnames)\s*\(/g;

// pattern to find array.join(' ') or array.join(" ") patterns
const ARRAY_JOIN_RE = /\[\s*([^\]]*)\]\s*\.\s*join\s*\(\s*['"][\s]*['"]\s*\)/g;

// pattern to find cva() (class-variance-authority) function calls
const CVA_START_RE = /\bcva\s*\(/g;

// extract Tailwind classes from dynamic expressions (className={...}, clsx(), cva(), array.join())
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
        addClasses(literal, classSet);
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
        addClasses(literal, classSet);
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
        addClasses(literal, classSet);
      }
    }
  }

  // extract classes from array.join(' ') patterns
  // example: ['flex', 'gap-4', condition && 'mt-2'].join(' ')
  extractArrayJoinPatterns(text: string, classSet: Set<string>): void {
    for (const match of text.matchAll(ARRAY_JOIN_RE)) {
      const arrayContent = match[1];
      // extract string literals from inside the array brackets
      const literals = this.extractStringLiterals(`[${arrayContent}]`);
      for (const literal of literals) {
        addClasses(literal, classSet);
      }
    }
  }

  // extract balanced expressions using brace/paren matching & handle nested braces properly
  extractBracedExpressions(
    text: string,
    startPattern: RegExp,
    openChar: string,
    closeChar: string
  ): string[] {
    return extractBraced(text, startPattern, openChar, closeChar);
  }

  // extract string literals from JavaScript expression w/ recursive template literal handling
  extractStringLiterals(expression: string, depth = 0): string[] {
    return extractLiterals(expression, depth);
  }
}
