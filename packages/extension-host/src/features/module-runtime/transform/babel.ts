// packages/extension-host/src/features/module-runtime/transform/babel.ts
// babel configuration for transpiling user code in MDX files
//
// webview evaluates modules using new Function() which requires CommonJS format
// preset-env converts ES modules (import/export) to CommonJS (require/module.exports)
//
// G.1 optimization: @babel/core is loaded dynamically on first transform,
// not at module initialization time. This reduces extension activation time
// for Safe Mode users who never need Babel

import type * as BabelCore from '@babel/core';
import { LogTags } from '@mdx-preview/contracts';
import { createTaggedLogger } from '../../../shared/logging/logger';
import { createLazyImport } from '../../../shared/utils/lazy-import';

// module-level tagged logger for Babel transpiler
const log = createTaggedLogger(LogTags.BABEL);

// lazy load @babel/core - only imported when first transform is requested
const getBabel = createLazyImport(() => import('@babel/core'));

// track prewarm state to prevent duplicate attempts
let prewarmStarted = false;
let prewarmComplete = false;

// module-level cache for lazily-initialized config items (G.4 optimization)
// config items are only created on first transformAsync() call
let cachedBabelOptions: BabelCore.TransformOptions | null = null;

// lazily initialize Babel options on first use
// config items are cached after first creation to avoid repeated require() calls
// this defers the expensive createConfigItem() & require() calls until first transform
async function getBabelOptions(
  babel: typeof BabelCore
): Promise<BabelCore.TransformOptions> {
  if (cachedBabelOptions) {
    return cachedBabelOptions;
  }

  // only now do we require presets/plugins & create config items
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
    // explicit options for performance
    ast: false,
    sourceMaps: false,
    configFile: false,
    babelrc: false,
  };

  return cachedBabelOptions;
}

// prewarm Babel by loading @babel/core in background
// safe to call multiple times (no-op if already warming/warmed)
export async function prewarmBabel(): Promise<void> {
  if (prewarmComplete || prewarmStarted) {
    return;
  }
  prewarmStarted = true;

  log.debug('Starting Babel prewarm');
  const startTime = Date.now();

  try {
    const babel = await getBabel();
    await getBabelOptions(babel);
    prewarmComplete = true;
    log.debug(`Babel prewarm complete (${Date.now() - startTime}ms)`);
  } catch (err) {
    prewarmStarted = false;
    log.debug('Babel prewarm failed', err);
  }
}

// check if Babel is prewarmed
export function isBabelPrewarmed(): boolean {
  return prewarmComplete;
}

// reset prewarm state for tests
export function resetPrewarmState(): void {
  prewarmStarted = false;
  prewarmComplete = false;
}

export const transformAsync = async (
  code: string
): Promise<BabelCore.BabelFileResult | null> => {
  const babel = await getBabel();
  const options = await getBabelOptions(babel);
  return babel.transformAsync(code, options);
};

// clear cached Babel config (for testing or hot reload scenarios)
export function clearBabelConfigCache(): void {
  cachedBabelOptions = null;
}
