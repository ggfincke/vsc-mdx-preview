// packages/extension/tailwind/scanning/PatternScanner.ts
// extract Tailwind classes from static patterns (className="...", @apply, @layer)

import { CLASS_TOKEN_RE } from '../constants';

// static class attribute: className="..." or class='...'
const CLASS_ATTR_RE = /\bclass(Name)?\s*=\s*("([^"]*)"|'([^']*)')/g;

// @apply directives in CSS
const APPLY_RE = /@apply\s+([^;]+);/g;

// @layer utilities/components blocks - extract custom class definitions
const LAYER_RE = /@layer\s+(?:utilities|components)\s*\{/g;

// CSS class selector pattern (matches .class-name in CSS)
const CSS_CLASS_SELECTOR_RE = /\.([A-Za-z_-][A-Za-z0-9_-]*)/g;

// extracts Tailwind classes from static patterns (className="...", @apply, @layer)
export class PatternScanner {
  // extract classes from static className/class attributes
  extractStaticAttributes(text: string, classSet: Set<string>): void {
    for (const match of text.matchAll(CLASS_ATTR_RE)) {
      const raw = match[3] ?? match[4] ?? '';
      this.addClasses(raw, classSet);
    }
  }

  // extract classes from @apply directives
  extractApplyDirectives(text: string, classSet: Set<string>): void {
    for (const match of text.matchAll(APPLY_RE)) {
      const raw = match[1] ?? '';
      this.addClasses(raw, classSet);
    }
  }

  // extract custom class names defined in @layer utilities/components blocks
  extractLayerClasses(
    text: string,
    classSet: Set<string>,
    extractBracedContent: (
      text: string,
      pattern: RegExp,
      open: string,
      close: string
    ) => string[]
  ): void {
    for (const layerContent of extractBracedContent(text, LAYER_RE, '{', '}')) {
      // extract all CSS class selectors from within the @layer block
      for (const match of layerContent.matchAll(CSS_CLASS_SELECTOR_RE)) {
        const className = match[1];
        if (className && CLASS_TOKEN_RE.test(className)) {
          classSet.add(className);
        }
      }
    }
  }

  // add space-separated class tokens to the set
  addClasses(raw: string, classSet: Set<string>): void {
    const tokens = raw.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      if (CLASS_TOKEN_RE.test(token)) {
        classSet.add(token);
      }
    }
  }
}
