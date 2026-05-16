// packages/contracts/src/config/enums.ts
// canonical enum arrays for runtime validation, settings & schema generation

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

// source-line highlight color mode options
// used in: package.json mdx-preview.preview.sourceLineHighlightColor setting
export const SOURCE_LINE_HIGHLIGHT_COLOR_VALUES = [
  'dependent',
  'white',
  'black',
  'auto',
] as const;
export type SourceLineHighlightColorValue =
  (typeof SOURCE_LINE_HIGHLIGHT_COLOR_VALUES)[number];

// preview scroll sync options
// used in: package.json mdx-preview.preview.scrollSync setting
export const PREVIEW_SCROLL_SYNC_VALUES = [
  'off',
  'editorToPreview',
  'previewToEditor',
  'bidirectional',
] as const;
export type PreviewScrollSyncValue =
  (typeof PREVIEW_SCROLL_SYNC_VALUES)[number];

export function isEditorToPreviewMode(mode: PreviewScrollSyncValue): boolean {
  return mode === 'editorToPreview' || mode === 'bidirectional';
}

export function isPreviewToEditorMode(mode: PreviewScrollSyncValue): boolean {
  return mode === 'previewToEditor' || mode === 'bidirectional';
}
