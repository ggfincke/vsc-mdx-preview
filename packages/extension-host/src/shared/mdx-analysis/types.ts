// packages/extension-host/src/shared/mdx-analysis/types.ts
// neutral AST node shapes shared by MDX analysis consumers

import type { Program } from 'estree';

export interface MdastPosition {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

export interface MdxjsEsmNode {
  type: 'mdxjsEsm';
  value: string;
  position?: MdastPosition;
  data?: { estree?: Program | null };
}
