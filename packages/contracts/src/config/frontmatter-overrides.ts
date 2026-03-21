// packages/contracts/src/config/frontmatter-overrides.ts
// canonical frontmatter override metadata (single source of truth)
// define which frontmatter keys are recognized as setting overrides,
// which setting they map to, & which values are valid

import { PREVIEW_THEMES, CODE_BLOCK_THEMES } from '../themes/data';

// descriptor for a frontmatter key that overrides a VS Code setting
export interface FrontmatterOverrideDescriptor {
  // frontmatter key (e.g., 'previewTheme')
  key: string;
  // setting key it overrides (e.g., 'preview.previewTheme')
  settingKey: string;
  // human-readable description for completions
  description: string;
  // valid values (readonly array), or null for free-form string
  validValues: readonly string[] | null;
}

// canonical frontmatter override descriptors
// these are the ONLY frontmatter keys recognized as VS Code setting overrides
export const FRONTMATTER_OVERRIDES: readonly FrontmatterOverrideDescriptor[] = [
  {
    key: 'previewTheme',
    settingKey: 'preview.previewTheme',
    description: 'MDX Preview theme override',
    validValues: PREVIEW_THEMES,
  },
  {
    key: 'codeBlockTheme',
    settingKey: 'preview.codeBlockTheme',
    description: 'Code block theme override',
    validValues: CODE_BLOCK_THEMES,
  },
] as const;

// quick lookup: frontmatter key -> descriptor
export const FRONTMATTER_OVERRIDE_MAP = new Map(
  FRONTMATTER_OVERRIDES.map((d) => [d.key, d])
);
