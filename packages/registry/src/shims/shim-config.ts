// packages/registry/src/shims/shim-config.ts
// define shim manifest for framework CSS & barrel exports

import type { FrameworkId } from '@mdx-preview/contracts';

export interface FrameworkCssConfig {
  framework: FrameworkId;
  cssImport: string | null;
  allowRetry: boolean;
}

export interface ShimBarrelExport {
  from: string;
  values?: string[];
  types?: string[];
}

export interface ShimBarrelConfig {
  outputPath: string;
  exports: ShimBarrelExport[];
  sideEffectImports?: string[];
}

export const FRAMEWORK_CSS_CONFIG: readonly FrameworkCssConfig[] = [
  {
    framework: 'generic',
    cssImport: 'features/shims/generic/styles.css',
    allowRetry: true,
  },
  {
    framework: 'docusaurus',
    cssImport: 'features/shims/docusaurus/styles.css',
    allowRetry: true,
  },
  {
    framework: 'starlight',
    cssImport: 'features/shims/starlight/styles.css',
    allowRetry: true,
  },
  {
    framework: 'nextra',
    cssImport: 'features/shims/nextra/styles.css',
    allowRetry: true,
  },
  {
    framework: 'nextjs',
    cssImport: null,
    allowRetry: false,
  },
];

export const SHIM_BARREL_CONFIG: readonly ShimBarrelConfig[] = [
  {
    outputPath: 'generated/shim-barrels/generic/index.ts',
    exports: [
      {
        from: './types',
        values: ['normalizeCalloutType', 'CALLOUT_TITLES'],
        types: [
          'CalloutType',
          'CalloutProps',
          'CollapsibleProps',
          'CodeGroupProps',
        ],
      },
      {
        from: './Callout',
        values: ['Callout', 'Alert', 'Admonition'],
      },
      {
        from: './Collapsible',
        values: ['Collapsible', 'Accordion'],
      },
      {
        from: './Tabs',
        values: ['Tabs', 'useGenericTabsContext'],
        types: ['TabsProps'],
      },
      {
        from: './TabItem',
        values: ['TabItem', 'Tab'],
      },
      {
        from: './CodeGroup',
        values: ['CodeGroup'],
      },
    ],
    sideEffectImports: ['./styles.css'],
  },
  {
    outputPath: 'generated/shim-barrels/docusaurus/index.ts',
    exports: [
      {
        from: './Tabs',
        values: ['Tabs', 'TabItem'],
        types: ['TabsProps', 'TabItemProps'],
      },
      {
        from: './CodeBlock',
        values: ['CodeBlock'],
        types: ['CodeBlockProps'],
      },
      {
        from: './Details',
        values: ['Details'],
        types: ['DetailsProps'],
      },
    ],
  },
  {
    outputPath: 'generated/shim-barrels/starlight/index.ts',
    exports: [
      {
        from: './Card',
        values: ['Card'],
        types: ['CardProps'],
      },
      {
        from: './CardGrid',
        values: ['CardGrid'],
        types: ['CardGridProps'],
      },
      {
        from: './LinkCard',
        values: ['LinkCard'],
        types: ['LinkCardProps'],
      },
      {
        from: './Steps',
        values: ['Steps'],
        types: ['StepsProps'],
      },
      {
        from: './Badge',
        values: ['Badge'],
        types: ['BadgeProps', 'BadgeVariant'],
      },
      {
        from: './Aside',
        values: ['Aside'],
        types: ['AsideProps', 'AsideType'],
      },
      {
        from: './Tabs',
        values: ['Tabs', 'TabItem'],
        types: ['TabsProps', 'TabItemProps'],
      },
      {
        from: './FileTree',
        values: ['FileTree'],
        types: ['FileTreeProps'],
      },
      {
        from: './Code',
        values: ['Code'],
        types: ['CodeProps'],
      },
    ],
  },
  {
    outputPath: 'generated/shim-barrels/nextra/index.ts',
    exports: [
      {
        from: './Callout',
        values: ['Callout'],
        types: ['CalloutProps', 'CalloutType'],
      },
      {
        from: './Tabs',
        values: ['Tabs'],
        types: ['TabsProps', 'TabProps', 'TabItem'],
      },
      {
        from: './Cards',
        values: ['Cards'],
        types: ['CardsProps', 'CardProps'],
      },
      {
        from: './FileTree',
        values: ['FileTree'],
        types: ['FileTreeProps'],
      },
      {
        from: './Steps',
        values: ['Steps'],
        types: ['StepsProps'],
      },
      {
        from: './Bleed',
        values: ['Bleed'],
        types: ['BleedProps'],
      },
    ],
  },
  {
    outputPath: 'generated/shim-barrels/nextjs/index.ts',
    exports: [
      {
        from: './Image',
        values: ['Image'],
        types: ['ImageProps'],
      },
      {
        from: './Link',
        values: ['Link'],
        types: ['LinkProps'],
      },
    ],
  },
];
