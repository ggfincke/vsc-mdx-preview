// packages/shared/codegen/generate-config-schema.ts
// generates the mdx-previewrc.schema.json from canonical TypeScript sources
// ensure JSON schema stays in sync w/ runtime validation enums

import { MDX_PREVIEW_CONFIG_SCHEMA } from '@mdx-preview/contracts';

// return static schema structure from shared config schema
export function generateConfigSchema(): object {
  return MDX_PREVIEW_CONFIG_SCHEMA;
}

// generate JSON string w/ proper formatting
export function generateConfigSchemaJson(): string {
  const schema = generateConfigSchema();
  return JSON.stringify(schema, null, 2) + '\n';
}
