// packages/contracts/src/runtime/preloaded-modules.ts
// canonical IDs for core preloaded modules (React, MDX, layout)

export const PRELOADED_MODULE_IDS = {
  // react core
  react: 'npm://react@18',
  reactDom: 'npm://react-dom@18',
  reactDomClient: 'npm://react-dom/client@18',
  jsxRuntime: 'npm://react/jsx-runtime@18',

  // mdx
  mdxReact: 'npm://@mdx-js/react@3',

  // layout (vscode-markdown-layout is the npm package name, not a VS Code API reference)
  vscodeLayout: 'npm://vscode-markdown-layout@0.1.0',
} as const;

export type PreloadedModuleId =
  (typeof PRELOADED_MODULE_IDS)[keyof typeof PRELOADED_MODULE_IDS];
