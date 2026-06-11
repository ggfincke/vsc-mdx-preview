// packages/codegen/src/lib/generate-config-schema.ts
// generate the mdx-previewrc.schema.json from canonical TypeScript sources
// ensure JSON schema stays in sync w/ runtime validation enums

import { MDX_PREVIEW_CONFIG_SCHEMA } from '@mdx-preview/contracts';

// generate JSON string w/ proper formatting
export function generateConfigSchemaJson(): string {
  return JSON.stringify(MDX_PREVIEW_CONFIG_SCHEMA, null, 2) + '\n';
}
