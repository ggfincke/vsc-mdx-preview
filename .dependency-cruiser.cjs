/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular-new-packages',
      severity: 'error',
      comment:
        'No circular dependencies in new packages. Pre-existing cycles in extension/webview are tracked separately.',
      from: { path: '^packages/(contracts|registry|runtime-utils|codegen)/' },
      to: { circular: true },
    },
    {
      name: 'no-extension-imports-webview',
      severity: 'error',
      comment: 'Extension code must not import from webview-client',
      from: { path: '^packages/extension-host/' },
      to: { path: '^packages/webview-client/' },
    },
    {
      name: 'no-webview-imports-extension',
      severity: 'error',
      comment:
        'Webview code must not import from extension (eslint configs excluded)',
      from: {
        path: '^packages/webview-client/',
        pathNot: 'eslint\\.config\\.mjs$',
      },
      to: { path: '^packages/extension-host/', pathNot: 'eslint-rules/' },
    },
    {
      name: 'no-generated-deep-imports',
      severity: 'error',
      comment:
        'Only feature barrel modules may import from generated output',
      from: {
        path: '^packages/webview-client/src/',
        pathNot: '^packages/webview-client/src/features/.*/index\\.ts$',
      },
      to: { path: '^packages/webview-client/src/generated/' },
    },
    {
      name: 'contracts-isolation',
      severity: 'error',
      comment: 'contracts must not depend on any other internal package',
      from: { path: '^packages/contracts/' },
      to: {
        path: '^packages/(registry|runtime-utils|codegen|extension-host|webview-client)/',
      },
    },
    {
      name: 'registry-allowed-deps',
      severity: 'error',
      comment: 'registry may only depend on contracts',
      from: { path: '^packages/registry/' },
      to: {
        path: '^packages/(runtime-utils|codegen|extension-host|webview-client)/',
      },
    },
    {
      name: 'runtime-utils-allowed-deps',
      severity: 'error',
      comment: 'runtime-utils may only depend on contracts',
      from: { path: '^packages/runtime-utils/' },
      to: {
        path: '^packages/(registry|codegen|extension-host|webview-client)/',
      },
    },
    {
      name: 'mdx-tools-self-contained',
      severity: 'error',
      comment:
        'mdx-tools must not import from @mdx-preview/* internal packages',
      from: { path: '^packages/mdx-tools/' },
      to: {
        path: '^packages/(contracts|registry|runtime-utils|codegen|extension-host|webview-client)/',
      },
    },
    {
      name: 'no-mdx-tools-browser-node-builtins',
      severity: 'error',
      comment: 'mdx-tools/browser must remain browser-safe (no Node builtins)',
      from: { path: '^packages/mdx-tools/src/browser/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'mdx-tools-internal-no-domains',
      severity: 'error',
      comment:
        'mdx-tools/internal must not import from domain dirs or @mdx-preview packages',
      from: { path: '^packages/mdx-tools/src/internal/' },
      to: {
        path: '^packages/(contracts|registry|runtime-utils|codegen|extension-host|webview-client)/',
      },
    },
    {
      name: 'codegen-allowed-deps',
      severity: 'error',
      comment:
        'codegen may only depend on contracts, registry, runtime-utils, & mdx-tools',
      from: { path: '^packages/codegen/' },
      to: { path: '^packages/(extension-host|webview-client)/' },
    },
    {
      name: 'no-shared-imports',
      severity: 'error',
      comment:
        'packages/shared was deleted in Phase 10 — use direct package imports',
      from: {},
      to: { path: '^packages/shared/' },
    },
    {
      name: 'no-contracts-node-builtins',
      severity: 'error',
      comment: 'contracts must not use Node.js built-in modules',
      from: { path: '^packages/contracts/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'no-runtime-utils-node-builtins',
      severity: 'error',
      comment: 'runtime-utils must remain browser-safe',
      from: { path: '^packages/runtime-utils/' },
      to: { dependencyTypes: ['core'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
