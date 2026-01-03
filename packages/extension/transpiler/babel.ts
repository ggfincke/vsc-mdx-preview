// packages/extension/transpiler/babel.ts
// Babel configuration for transpiling user code in MDX files

import * as babel from '@babel/core';

// babel configuration (@babel/preset-env handles dynamic imports)
const babelOptions = {
  presets: [
    babel.createConfigItem([
      require('@babel/preset-env'),
      { exclude: ['transform-regenerator'] },
    ]),
    babel.createConfigItem(require('@babel/preset-react')),
  ],
  plugins: [
    // stage-1 proposal: export default from (kept for real-world compatibility)
    babel.createConfigItem(
      require('@babel/plugin-proposal-export-default-from')
    ),
    // standard ES2020+ transforms (renamed from deprecated plugin-proposal-* packages)
    babel.createConfigItem(
      require('@babel/plugin-transform-export-namespace-from')
    ),
    babel.createConfigItem(require('@babel/plugin-transform-class-properties')),
    babel.createConfigItem(
      require('@babel/plugin-transform-optional-chaining')
    ),
    babel.createConfigItem(
      require('@babel/plugin-transform-nullish-coalescing-operator')
    ),
  ],
};

export const transformAsync = (
  code: string
): Promise<babel.BabelFileResult | null> => {
  return babel.transformAsync(code, babelOptions);
};
