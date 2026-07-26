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
  SOURCE_LINE_HIGHLIGHT_COLOR_VALUES,
  PREVIEW_SCROLL_SYNC_VALUES,
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

export interface SettingEnumEntry<Value extends string = string> {
  value: Value;
  description: string;
}

// package.json shape for settings-related codegen scripts
export interface PackageJson {
  contributes?: {
    configuration?: {
      properties?: Record<string, SettingProperty>;
    };
  };
}

function defineSettingEnumEntries<const Values extends readonly string[]>(
  settingKey: string,
  canonicalValues: Values,
  entries: readonly SettingEnumEntry<Values[number]>[]
): readonly SettingEnumEntry<Values[number]>[] {
  const entryValues = entries.map(({ value }) => value);
  if (
    entryValues.length !== canonicalValues.length ||
    entryValues.some((value, index) => value !== canonicalValues[index])
  ) {
    throw new Error(
      `Settings descriptor values for ${settingKey} must match contracts order`
    );
  }
  return entries;
}

// canonical ordered setting values & descriptions
export const SETTINGS_ENUM_DESCRIPTORS: Record<
  string,
  readonly SettingEnumEntry[]
> = {
  'mdx-preview.preview.previewTheme': defineSettingEnumEntries(
    'mdx-preview.preview.previewTheme',
    PREVIEW_THEMES,
    [
      { value: 'github-light', description: 'GitHub Light theme' },
      { value: 'github-dark', description: 'GitHub Dark theme' },
      { value: 'atom-dark', description: 'Atom Dark theme' },
      { value: 'atom-light', description: 'Atom Light theme' },
      { value: 'atom-material', description: 'Atom Material theme' },
      { value: 'one-dark', description: 'One Dark theme' },
      { value: 'one-light', description: 'One Light theme' },
      { value: 'solarized-dark', description: 'Solarized Dark theme' },
      { value: 'solarized-light', description: 'Solarized Light theme' },
      { value: 'gothic', description: 'Gothic theme' },
      { value: 'medium', description: 'Medium theme' },
      { value: 'monokai', description: 'Monokai theme' },
      { value: 'newsprint', description: 'Newsprint theme' },
      { value: 'night', description: 'Night theme' },
      { value: 'none', description: 'No theme (inherit)' },
      { value: 'vue', description: 'Vue theme' },
    ]
  ),
  'mdx-preview.preview.codeBlockTheme': defineSettingEnumEntries(
    'mdx-preview.preview.codeBlockTheme',
    CODE_BLOCK_THEMES,
    [
      { value: 'auto', description: 'Auto-select based on preview theme' },
      { value: 'default', description: 'Default syntax highlighting' },
      { value: 'atom-dark', description: 'Atom Dark syntax theme' },
      { value: 'atom-light', description: 'Atom Light syntax theme' },
      { value: 'atom-material', description: 'Atom Material syntax theme' },
      { value: 'coy', description: 'Coy syntax theme' },
      { value: 'darcula', description: 'Darcula syntax theme' },
      { value: 'dark', description: 'Dark syntax theme' },
      { value: 'funky', description: 'Funky syntax theme' },
      { value: 'github', description: 'GitHub syntax theme' },
      { value: 'github-dark', description: 'GitHub Dark syntax theme' },
      { value: 'hopscotch', description: 'Hopscotch syntax theme' },
      { value: 'monokai', description: 'Monokai syntax theme' },
      { value: 'okaidia', description: 'Okaidia syntax theme' },
      { value: 'one-dark', description: 'One Dark syntax theme' },
      { value: 'one-light', description: 'One Light syntax theme' },
      {
        value: 'pen-paper-coffee',
        description: 'Pen Paper Coffee syntax theme',
      },
      { value: 'pojoaque', description: 'Pojoaque syntax theme' },
      { value: 'solarized-dark', description: 'Solarized Dark syntax theme' },
      {
        value: 'solarized-light',
        description: 'Solarized Light syntax theme',
      },
      { value: 'twilight', description: 'Twilight syntax theme' },
      { value: 'vs', description: 'VS syntax theme' },
      { value: 'vue', description: 'Vue syntax theme' },
      { value: 'xonokai', description: 'Xonokai syntax theme' },
    ]
  ),
  'mdx-preview.preview.mermaidTheme': defineSettingEnumEntries(
    'mdx-preview.preview.mermaidTheme',
    MERMAID_THEMES,
    [
      {
        value: 'default',
        description: 'Light theme with good text contrast (recommended)',
      },
      { value: 'dark', description: 'Dark theme for dark backgrounds' },
      { value: 'forest', description: 'Green-tinted forest theme' },
      { value: 'neutral', description: 'Neutral grayscale theme' },
      { value: 'base', description: 'Minimal base theme for custom styling' },
      { value: 'null', description: 'No theme applied (raw SVG)' },
    ]
  ),
  'mdx-preview.framework': defineSettingEnumEntries(
    'mdx-preview.framework',
    FRAMEWORK_SETTINGS,
    [
      { value: 'auto', description: 'Auto-detect framework from package.json' },
      {
        value: 'generic',
        description: 'Generic MDX (no framework-specific features)',
      },
      {
        value: 'docusaurus',
        description: 'Docusaurus (@theme/* imports, admonitions)',
      },
      {
        value: 'nextjs',
        description: 'Next.js (mdx-components.tsx support)',
      },
      {
        value: 'starlight',
        description: 'Astro Starlight (@astrojs/starlight/components)',
      },
      {
        value: 'nextra',
        description: 'Nextra (nextra/components, theme-docs)',
      },
    ]
  ),
  'mdx-preview.tailwind.enabled': defineSettingEnumEntries(
    'mdx-preview.tailwind.enabled',
    TAILWIND_ENABLED_VALUES,
    [
      {
        value: 'auto',
        description: 'Auto-detect based on workspace dependencies',
      },
      {
        value: 'enabled',
        description: 'Always enable Tailwind CSS compilation',
      },
      {
        value: 'disabled',
        description: 'Disable Tailwind CSS compilation',
      },
    ]
  ),
  'mdx-preview.components.unknownBehavior': defineSettingEnumEntries(
    'mdx-preview.components.unknownBehavior',
    UNKNOWN_BEHAVIOR_VALUES,
    [
      { value: 'strip', description: 'Remove the component entirely' },
      {
        value: 'placeholder',
        description: 'Show a placeholder box with component name and children',
      },
      {
        value: 'raw',
        description: 'Remove the wrapper but render children inline',
      },
    ]
  ),
  'mdx-preview.preview.updateMode': defineSettingEnumEntries(
    'mdx-preview.preview.updateMode',
    UPDATE_MODE_VALUES,
    [
      {
        value: 'onType',
        description: 'Update preview as you type (debounced)',
      },
      { value: 'onSave', description: 'Update preview when file is saved' },
      { value: 'manual', description: 'Only update when manually refreshed' },
    ]
  ),
  'mdx-preview.preview.security': defineSettingEnumEntries(
    'mdx-preview.preview.security',
    SECURITY_POLICY_VALUES,
    [
      { value: 'strict', description: 'Do not allow insecure content or eval' },
      {
        value: 'disabled',
        description: 'Allow insecure content (not recommended)',
      },
    ]
  ),
  'mdx-preview.preview.sourceLineHighlightColor': defineSettingEnumEntries(
    'mdx-preview.preview.sourceLineHighlightColor',
    SOURCE_LINE_HIGHLIGHT_COLOR_VALUES,
    [
      {
        value: 'dependent',
        description:
          'Use VS Code theme token color (editorInfo foreground) with semantic callout highlight accents',
      },
      {
        value: 'white',
        description: 'Force all source-line highlight bars to white',
      },
      {
        value: 'black',
        description: 'Force all source-line highlight bars to black',
      },
      {
        value: 'auto',
        description:
          'Automatically use white in dark/high-contrast themes and black in light themes',
      },
    ]
  ),
  'mdx-preview.preview.scrollSync': defineSettingEnumEntries(
    'mdx-preview.preview.scrollSync',
    PREVIEW_SCROLL_SYNC_VALUES,
    [
      { value: 'off', description: 'Disable scroll synchronization.' },
      {
        value: 'editorToPreview',
        description:
          "Scroll the preview to follow the editor's visible source line.",
      },
      {
        value: 'previewToEditor',
        description:
          'Reveal the matching editor source line as the preview scrolls.',
      },
      {
        value: 'bidirectional',
        description:
          'Keep the editor and preview synchronized in both directions.',
      },
    ]
  ),
};
