// packages/extension/transpiler/sucrase.ts
// Sucrase transform for fast JSX & TypeScript transpilation

import { transform as sucraseTransform } from 'sucrase';

// transform code using Sucrase (JSX, TypeScript, imports)
export const transform = (code: string) => {
  return sucraseTransform(code, {
    transforms: ['jsx', 'typescript', 'imports'],
  });
};
