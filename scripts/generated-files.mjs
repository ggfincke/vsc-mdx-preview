// scripts/generated-files.mjs
// shared generated-file manifests for guardrail scripts

export const GENERATED_TS_FILES = [
  'packages/webview-client/src/generated/preload/preload.generated.ts',
  'packages/webview-client/src/generated/preload/aliases.generated.ts',
  'packages/webview-client/src/generated/framework-css/frameworkCssLoader.ts',
  'packages/webview-client/src/generated/shim-barrels/generic/index.ts',
  'packages/webview-client/src/generated/shim-barrels/docusaurus/index.ts',
  'packages/webview-client/src/generated/shim-barrels/starlight/index.ts',
  'packages/webview-client/src/generated/shim-barrels/nextra/index.ts',
  'packages/webview-client/src/generated/shim-barrels/nextjs/index.ts',
];

export const GENERATED_JSON_FILES = ['schemas/mdx-previewrc.schema.json'];

export const ALL_GENERATED_FILES = [
  ...GENERATED_TS_FILES,
  ...GENERATED_JSON_FILES,
];
