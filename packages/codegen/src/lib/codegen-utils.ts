// packages/codegen/src/lib/codegen-utils.ts
// shared utilities for codegen library functions

import {
  PREVIEW_THEMES,
  CODE_BLOCK_THEMES,
  MERMAID_THEMES,
  FRAMEWORK_SETTINGS,
  TAILWIND_ENABLED_VALUES,
  UNKNOWN_BEHAVIOR_VALUES,
  UPDATE_MODE_VALUES,
  SECURITY_POLICY_VALUES,
} from '@mdx-preview/contracts';

// normalize a file path to a valid import path (forward slashes, relative prefix)
export function normalizeImportPath(filePath: string): string {
  const withSlashes = filePath.replace(/\\/g, '/');
  if (withSlashes.startsWith('.')) {
    return withSlashes;
  }
  return `./${withSlashes}`;
}

// generate standard auto-generated file header
export function createGeneratedHeader(sourceFile: string): string {
  return `// AUTO-GENERATED FILE - DO NOT EDIT\n// Source: ${sourceFile}\n`;
}

// property shape for package.json contributes.configuration.properties
export interface SettingProperty {
  default?: unknown;
  enum?: string[];
  enumDescriptions?: string[];
  [key: string]: unknown;
}

// package.json shape for settings-related codegen scripts
export interface PackageJson {
  contributes?: {
    configuration?: {
      properties?: Record<string, SettingProperty>;
    };
  };
}

// mapping of setting keys to canonical enum arrays
export const SETTINGS_ENUM_MAP: Record<string, readonly string[]> = {
  'mdx-preview.preview.previewTheme': PREVIEW_THEMES,
  'mdx-preview.preview.codeBlockTheme': CODE_BLOCK_THEMES,
  'mdx-preview.preview.mermaidTheme': MERMAID_THEMES,
  'mdx-preview.framework': FRAMEWORK_SETTINGS,
  'mdx-preview.tailwind.enabled': TAILWIND_ENABLED_VALUES,
  'mdx-preview.components.unknownBehavior': UNKNOWN_BEHAVIOR_VALUES,
  'mdx-preview.preview.updateMode': UPDATE_MODE_VALUES,
  'mdx-preview.preview.security': SECURITY_POLICY_VALUES,
};
