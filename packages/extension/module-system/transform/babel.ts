// packages/extension/module-system/transform/babel.ts
// babel configuration for transpiling user code in MDX files
//
// webview evaluates modules using new Function() which requires CommonJS format
// preset-env converts ES modules (import/export) to CommonJS (require/module.exports)
//
// G.1 optimization: @babel/core is loaded dynamically on first transform,
// not at module initialization time. This reduces extension activation time
// for Safe Mode users who never need Babel.

import { createLazyImport } from '../../utils/lazy-import';
import type * as BabelCore from '@babel/core';

// Lazy load @babel/core - only imported when first transform is requested
const getBabel = createLazyImport(() => import('@babel/core'));

// Module-level cache for lazily-initialized config items (G.4 optimization)
// Config items are only created on first transformAsync() call
let cachedBabelOptions: BabelCore.TransformOptions | null = null;

/**
 * Lazily initialize Babel options on first use.
 * Config items are cached after first creation to avoid repeated require() calls.
 * This defers the expensive createConfigItem() and require() calls until first transform.
 */
async function getBabelOptions(
  babel: typeof BabelCore
): Promise<BabelCore.TransformOptions> {
  if (cachedBabelOptions) {
    return cachedBabelOptions;
  }

  // Only now do we require presets/plugins and create config items
  cachedBabelOptions = {
    presets: [
      // ES modules -> CommonJS (required for webview Function() evaluation)
      babel.createConfigItem([
        require('@babel/preset-env'),
        {
          modules: 'commonjs',
          // only transform modules, not syntax (Node 20+ handles rest)
          targets: { node: 'current' },
        },
      ]),
      // JSX transformation (required for React components)
      babel.createConfigItem(require('@babel/preset-react')),
    ],
    plugins: [
      // stage-1 proposal: export default from (not native in Node/browsers)
      babel.createConfigItem(
        require('@babel/plugin-proposal-export-default-from')
      ),
    ],
    // Explicit options for performance
    ast: false,
    sourceMaps: false,
    configFile: false,
    babelrc: false,
  };

  return cachedBabelOptions;
}

export const transformAsync = async (
  code: string
): Promise<BabelCore.BabelFileResult | null> => {
  const babel = await getBabel();
  const options = await getBabelOptions(babel);
  return babel.transformAsync(code, options);
};

/**
 * Clear cached Babel config (for testing or hot reload scenarios).
 */
export function clearBabelConfigCache(): void {
  cachedBabelOptions = null;
}
