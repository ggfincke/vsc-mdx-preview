// packages/contracts/src/frameworks.ts
// canonical framework metadata (single source of truth for IDs, labels, icons, & descriptions)

// framework IDs used by the shim registry
// Framework = frameworks w/ shims (excludes 'generic')
export type Framework = 'docusaurus' | 'starlight' | 'nextjs' | 'nextra';

// FrameworkId = all frameworks including 'generic' (canonical runtime type)
export type FrameworkId = Framework | 'generic';

// FrameworkSetting = VS Code setting type ('auto' triggers detection)
export type FrameworkSetting = 'auto' | FrameworkId;

// canonical descriptor for framework UI metadata
export interface FrameworkDescriptor {
  // canonical framework ID
  id: FrameworkId;
  // display label used in status bar & UI
  displayLabel: string;
  // picker label shown in QuickPick menus
  pickerLabel: string;
  // VS Code setting enumDescription text
  settingDescription: string;
  // codicon token for status bar
  icon: string;
}

// canonical framework metadata keyed by FrameworkId
// derive all UI labels, icons, picker text, & setting descriptions from this
export const FRAMEWORK_METADATA: Record<FrameworkId, FrameworkDescriptor> = {
  generic: {
    id: 'generic',
    displayLabel: 'Generic',
    pickerLabel: 'Generic',
    settingDescription: 'Generic MDX (no framework-specific features)',
    icon: '$(symbol-misc)',
  },
  docusaurus: {
    id: 'docusaurus',
    displayLabel: 'Docusaurus',
    pickerLabel: 'Docusaurus',
    settingDescription: 'Docusaurus (@theme/* imports, admonitions)',
    icon: '$(book)',
  },
  nextjs: {
    id: 'nextjs',
    displayLabel: 'Next.js',
    pickerLabel: 'Next.js',
    settingDescription: 'Next.js (mdx-components.tsx support)',
    icon: '$(server)',
  },
  starlight: {
    id: 'starlight',
    displayLabel: 'Starlight',
    pickerLabel: 'Astro Starlight',
    settingDescription: 'Astro Starlight (@astrojs/starlight/components)',
    icon: '$(star)',
  },
  nextra: {
    id: 'nextra',
    displayLabel: 'Nextra',
    pickerLabel: 'Nextra',
    settingDescription: 'Nextra (nextra/components, theme-docs)',
    icon: '$(notebook)',
  },
};

// helper: get display name for a framework ID
export function getFrameworkDisplayName(framework: FrameworkId): string {
  return FRAMEWORK_METADATA[framework].displayLabel;
}

// helper: get status bar icon for a framework ID
export function getFrameworkIcon(framework: FrameworkId): string {
  return FRAMEWORK_METADATA[framework].icon;
}
