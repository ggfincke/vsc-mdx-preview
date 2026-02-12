// packages/extension/module-system/transform/sucrase.ts
// sucrase transform for fast JSX & TypeScript transpilation

import { transform as sucraseTransformImpl } from 'sucrase';

export const sucraseTransform = sucraseTransformImpl;

// transform code using Sucrase (JSX, TypeScript, imports)
export const transform = (code: string) => {
  return sucraseTransform(code, {
    transforms: ['jsx', 'typescript', 'imports'],
  });
};
