// packages/shared/config/enums.ts
// Canonical enum arrays for config validation & VS Code settings
// These are the single source of truth for all enum values used in:
// - Runtime validation (packages/extension/utils/validation/schema.ts)
// - VS Code settings (package.json contributes.configuration)
// - JSON schema (schemas/mdx-previewrc.schema.json)

import type { FrameworkId, FrameworkSetting } from '../registry';

// Framework IDs for config file validation (excludes 'auto')
// Used in: .mdx-previewrc.json framework field, runtime validation
export const FRAMEWORK_IDS: readonly FrameworkId[] = [
  'generic',
  'docusaurus',
  'nextjs',
  'starlight',
  'nextra',
] as const;

// Framework settings for VS Code (includes 'auto' for auto-detection)
// Used in: package.json mdx-preview.framework setting
export const FRAMEWORK_SETTINGS: readonly FrameworkSetting[] = [
  'auto',
  'generic',
  'docusaurus',
  'nextjs',
  'starlight',
  'nextra',
] as const;

// Tailwind enabled options
// Used in: package.json, .mdx-previewrc.json, runtime validation
export const TAILWIND_ENABLED_VALUES = ['auto', 'enabled', 'disabled'] as const;
export type TailwindEnabledValue = (typeof TAILWIND_ENABLED_VALUES)[number];

// Unknown component behavior options
// Used in: package.json, .mdx-previewrc.json, runtime validation
export const UNKNOWN_BEHAVIOR_VALUES = ['strip', 'placeholder', 'raw'] as const;
export type UnknownBehaviorValue = (typeof UNKNOWN_BEHAVIOR_VALUES)[number];

// Preview update mode options
// Used in: package.json mdx-preview.preview.updateMode setting
export const UPDATE_MODE_VALUES = ['onType', 'onSave', 'manual'] as const;
export type UpdateModeValue = (typeof UPDATE_MODE_VALUES)[number];

// Security policy options
// Used in: package.json mdx-preview.preview.security setting
export const SECURITY_POLICY_VALUES = ['strict', 'disabled'] as const;
export type SecurityPolicyValue = (typeof SECURITY_POLICY_VALUES)[number];
