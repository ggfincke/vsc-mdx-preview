// packages/contracts/src/config/enums.ts
// canonical enum arrays for config validation & VS Code settings
// these are the single source of truth for all enum values used in
// - runtime validation (packages/extension/utils/validation/schema.ts)
// - VS Code settings (package.json contributes.configuration)
// - JSON schema (schemas/mdx-previewrc.schema.json)

import type { FrameworkId, FrameworkSetting } from '../frameworks';

// framework IDs for config file validation (excludes 'auto')
// used in: .mdx-previewrc.json framework field, runtime validation
export const FRAMEWORK_IDS: readonly FrameworkId[] = [
  'generic',
  'docusaurus',
  'nextjs',
  'starlight',
  'nextra',
] as const;

// framework settings for VS Code (includes 'auto' for auto-detection)
// used in: package.json mdx-preview.framework setting
export const FRAMEWORK_SETTINGS: readonly FrameworkSetting[] = [
  'auto',
  'generic',
  'docusaurus',
  'nextjs',
  'starlight',
  'nextra',
] as const;

// tailwind enabled options
// used in: package.json, .mdx-previewrc.json, runtime validation
export const TAILWIND_ENABLED_VALUES = ['auto', 'enabled', 'disabled'] as const;
export type TailwindEnabledValue = (typeof TAILWIND_ENABLED_VALUES)[number];

// unknown component behavior options
// used in: package.json, .mdx-previewrc.json, runtime validation
export const UNKNOWN_BEHAVIOR_VALUES = ['strip', 'placeholder', 'raw'] as const;
export type UnknownBehaviorValue = (typeof UNKNOWN_BEHAVIOR_VALUES)[number];

// preview update mode options
// used in: package.json mdx-preview.preview.updateMode setting
export const UPDATE_MODE_VALUES = ['onType', 'onSave', 'manual'] as const;
export type UpdateModeValue = (typeof UPDATE_MODE_VALUES)[number];

// security policy options
// used in: package.json mdx-preview.preview.security setting
export const SECURITY_POLICY_VALUES = ['strict', 'disabled'] as const;
export type SecurityPolicyValue = (typeof SECURITY_POLICY_VALUES)[number];
