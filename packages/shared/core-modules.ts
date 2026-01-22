// packages/shared/core-modules.ts
// canonical IDs for core preloaded modules (React, MDX, layout)

export const PRELOADED_MODULE_IDS = {
  // React core
  react: 'npm://react@18',
  reactLatest: 'npm://react@latest',
  reactDom: 'npm://react-dom@18',
  reactDomLatest: 'npm://react-dom@latest',
  reactDomClient: 'npm://react-dom/client@18',
  jsxRuntime: 'npm://react/jsx-runtime@18',

  // MDX
  mdxReact: 'npm://@mdx-js/react@3',
  mdxReactLatest: 'npm://@mdx-js/react@latest',

  // Layout
  vscodeLayout: 'npm://vscode-markdown-layout@0.1.0',
  vscodeLayoutLatest: 'npm://vscode-markdown-layout@latest',
} as const;

export type PreloadedModuleId =
  (typeof PRELOADED_MODULE_IDS)[keyof typeof PRELOADED_MODULE_IDS];
