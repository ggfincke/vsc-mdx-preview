// packages/extension/tailwind/scanning/utils.ts
// shared utilities for Tailwind class extraction

import { CLASS_TOKEN_RE } from '../constants';

// add space-separated class tokens to the set
export function addClasses(raw: string, classSet: Set<string>): void {
  const tokens = raw.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (CLASS_TOKEN_RE.test(token)) {
      classSet.add(token);
    }
  }
}
