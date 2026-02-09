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
      comment: 'Extension code must not import from webview-app',
      from: { path: '^packages/extension/' },
      to: { path: '^packages/webview-app/' },
    },
    {
      name: 'no-webview-imports-extension',
      severity: 'error',
      comment:
        'Webview code must not import from extension (eslint configs excluded)',
      from: {
        path: '^packages/webview-app/',
        pathNot: 'eslint\\.config\\.mjs$',
      },
      to: { path: '^packages/extension/', pathNot: 'eslint-rules/' },
    },
    {
      name: 'contracts-isolation',
      severity: 'error',
      comment: 'contracts must not depend on any other internal package',
      from: { path: '^packages/contracts/' },
      to: {
        path: '^packages/(registry|runtime-utils|codegen|extension|webview-app|shared)/',
      },
    },
    {
      name: 'registry-allowed-deps',
      severity: 'error',
      comment: 'registry may only depend on contracts',
      from: { path: '^packages/registry/' },
      to: {
        path: '^packages/(runtime-utils|codegen|extension|webview-app|shared)/',
      },
    },
    {
      name: 'runtime-utils-allowed-deps',
      severity: 'error',
      comment: 'runtime-utils may only depend on contracts',
      from: { path: '^packages/runtime-utils/' },
      to: {
        path: '^packages/(registry|codegen|extension|webview-app|shared)/',
      },
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
