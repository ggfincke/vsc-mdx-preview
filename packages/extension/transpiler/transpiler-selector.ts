// packages/extension/transpiler/transpiler-selector.ts
// unified transpiler selection w/ automatic fallback from Sucrase to Babel

import { transformAsync as babelTransformAsync } from './babel';
import { transform as sucraseTransform } from './sucrase';
import { debug } from '../logging';

export interface TranspileOptions {
  // whether to prefer Sucrase over Babel
  useSucrase: boolean;
  // context for debug logging (e.g., 'entry' or 'dependency')
  context?: string;
  // file path for debug logging
  filePath?: string;
}

// transpile code w/ automatic fallback from Sucrase to Babel.
// when useSucrase is true, attempts Sucrase first & falls back to Babel on failure.
// when useSucrase is false, uses Babel directly.
export async function transpileWithFallback(
  code: string,
  options: TranspileOptions
): Promise<string> {
  const { useSucrase, context = 'unknown', filePath } = options;

  if (useSucrase) {
    try {
      return sucraseTransform(code).code;
    } catch (e) {
      debug(`Sucrase failed for ${context}, falling back to Babel`, {
        file: filePath,
        error: e,
      });
      const result = await babelTransformAsync(code);
      return result?.code ?? code;
    }
  }

  const result = await babelTransformAsync(code);
  return result?.code ?? code;
}
