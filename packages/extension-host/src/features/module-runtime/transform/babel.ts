// packages/extension-host/src/features/module-runtime/transform/babel.ts
// transpile user code to CommonJS for new Function() webview evaluation
// load @babel/core lazily so Safe Mode users avoid activation cost

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
let cachedBabelOptions: BabelCore.InputOptions | null = null;

// lazily initialize Babel options on first use
// config items are cached after first creation to avoid repeated require() calls
// this defers the expensive createConfigItem() & require() calls until first transform
async function getBabelOptions(
  babel: typeof BabelCore
): Promise<BabelCore.InputOptions> {
  if (cachedBabelOptions) {
    return cachedBabelOptions;
  }

  // only now do we require presets/plugins & create config items
  cachedBabelOptions = {
    presets: [
      // ES modules -> CommonJS (required for webview Function() evaluation)
      babel.createConfigItemSync(
        [
          require('@babel/preset-env'),
          {
            modules: 'commonjs',
            // only transform modules, not syntax (Node 20+ handles rest)
            targets: { node: 'current' },
          },
        ],
        { type: 'preset' }
      ),
      // JSX transformation (required for React components)
      babel.createConfigItemSync(
        [require('@babel/preset-react'), { runtime: 'classic' }],
        { type: 'preset' }
      ),
    ],
    plugins: [
      // stage-1 proposal: export default from (not native in Node/browsers)
      babel.createConfigItemSync(
        require('@babel/plugin-proposal-export-default-from'),
        { type: 'plugin' }
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

export const transformAsync = async (
  code: string
): Promise<BabelCore.FileResult | null> => {
  const babel = await getBabel();
  const options = await getBabelOptions(babel);
  return babel.transformAsync(code, options);
};
