// packages/extension/module-system/transform/babel.ts
// babel configuration for transpiling user code in MDX files
//
// webview evaluates modules using new Function() which requires CommonJS format
// preset-env converts ES modules (import/export) to CommonJS (require/module.exports)

import * as babel from '@babel/core';

// babel configuration for module transformation and JSX
const babelOptions = {
  presets: [
    // ES modules → CommonJS (required for webview Function() evaluation)
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
};

export const transformAsync = (
  code: string
): Promise<babel.BabelFileResult | null> => {
  return babel.transformAsync(code, babelOptions);
};
