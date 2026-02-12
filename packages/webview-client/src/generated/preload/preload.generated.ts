// AUTO-GENERATED FILE - DO NOT EDIT
// Source: packages/mdx-forge/src/components/registry/registry-data.ts

import type { ModuleRegistry } from 'mdx-forge/browser/registry';
import {
  createBarrelModule,
  createComponentModule,
  preloadEntry,
} from '../../features/module-runtime/preload/core';
import type { FrameworkId } from '@mdx-preview/contracts';

// static imports for generic shims
import { Callout as generic_Callout } from 'mdx-forge/components/generic';
import { Collapsible as generic_Collapsible } from 'mdx-forge/components/generic';
import { Tabs as generic_Tabs } from 'mdx-forge/components/generic';
import { TabItem as generic_TabItem } from 'mdx-forge/components/generic';
import { CodeGroup as generic_CodeGroup } from 'mdx-forge/components/generic';

// preload generic shims synchronously
export function preloadGenericShims(registry: ModuleRegistry): void {
  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-generic/Callout',
    exports: createComponentModule(generic_Callout, [
      'Callout',
      'Alert',
      'Admonition',
    ]),
    aliases: [
      '@mdx-preview/shims/generic/Admonition',
      '@mdx-preview/shims/generic/Alert',
      '@mdx-preview/shims/generic/Callout',
      'Admonition',
      'Alert',
      'Callout',
    ],
  });
  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-generic/Collapsible',
    exports: createComponentModule(generic_Collapsible, [
      'Collapsible',
      'Accordion',
      'Details',
    ]),
    aliases: [
      '@mdx-preview/shims/generic/Accordion',
      '@mdx-preview/shims/generic/Collapsible',
      '@mdx-preview/shims/generic/Details',
      'Accordion',
      'Collapsible',
      'Details',
    ],
  });
  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-generic/Tabs',
    exports: createComponentModule(generic_Tabs, ['Tabs']),
    aliases: ['@mdx-preview/shims/generic/Tabs', 'Tabs'],
  });
  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-generic/TabItem',
    exports: createComponentModule(generic_TabItem, ['TabItem', 'Tab']),
    aliases: [
      '@mdx-preview/shims/generic/Tab',
      '@mdx-preview/shims/generic/TabItem',
      'Tab',
      'TabItem',
    ],
  });
  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-generic/CodeGroup',
    exports: createComponentModule(generic_CodeGroup, ['CodeGroup']),
    aliases: ['@mdx-preview/shims/generic/CodeGroup', 'CodeGroup'],
  });
}

// individual lazy loaders for conditional generic shim preloading
export const GENERIC_SHIM_LOADERS: Record<
  string,
  (registry: ModuleRegistry) => Promise<void>
> = {
  Callout: async (registry: ModuleRegistry) => {
    const component = await import('mdx-forge/components/generic').then(
      (m) => m.Callout
    );
    preloadEntry(registry, {
      id: 'npm://@mdx-preview/shims-generic/Callout',
      exports: createComponentModule(component, [
        'Callout',
        'Alert',
        'Admonition',
      ]),
      aliases: [
        '@mdx-preview/shims/generic/Admonition',
        '@mdx-preview/shims/generic/Alert',
        '@mdx-preview/shims/generic/Callout',
        'Admonition',
        'Alert',
        'Callout',
      ],
    });
  },
  Collapsible: async (registry: ModuleRegistry) => {
    const component = await import('mdx-forge/components/generic').then(
      (m) => m.Collapsible
    );
    preloadEntry(registry, {
      id: 'npm://@mdx-preview/shims-generic/Collapsible',
      exports: createComponentModule(component, [
        'Collapsible',
        'Accordion',
        'Details',
      ]),
      aliases: [
        '@mdx-preview/shims/generic/Accordion',
        '@mdx-preview/shims/generic/Collapsible',
        '@mdx-preview/shims/generic/Details',
        'Accordion',
        'Collapsible',
        'Details',
      ],
    });
  },
  Tabs: async (registry: ModuleRegistry) => {
    const component = await import('mdx-forge/components/generic').then(
      (m) => m.Tabs
    );
    preloadEntry(registry, {
      id: 'npm://@mdx-preview/shims-generic/Tabs',
      exports: createComponentModule(component, ['Tabs']),
      aliases: ['@mdx-preview/shims/generic/Tabs', 'Tabs'],
    });
  },
  TabItem: async (registry: ModuleRegistry) => {
    const component = await import('mdx-forge/components/generic').then(
      (m) => m.TabItem
    );
    preloadEntry(registry, {
      id: 'npm://@mdx-preview/shims-generic/TabItem',
      exports: createComponentModule(component, ['TabItem', 'Tab']),
      aliases: [
        '@mdx-preview/shims/generic/Tab',
        '@mdx-preview/shims/generic/TabItem',
        'Tab',
        'TabItem',
      ],
    });
  },
  CodeGroup: async (registry: ModuleRegistry) => {
    const component = await import('mdx-forge/components/generic').then(
      (m) => m.CodeGroup
    );
    preloadEntry(registry, {
      id: 'npm://@mdx-preview/shims-generic/CodeGroup',
      exports: createComponentModule(component, ['CodeGroup']),
      aliases: ['@mdx-preview/shims/generic/CodeGroup', 'CodeGroup'],
    });
  },
};

// lazy-load docusaurus shims on demand
export async function loadDocusaurusShims(
  registry: ModuleRegistry
): Promise<void> {
  const [
    docusaurus_Tabs,
    docusaurus_TabItem,
    docusaurus_CodeBlock,
    docusaurus_Details,
  ] = await Promise.all([
    import('mdx-forge/components/docusaurus').then((m) => m.Tabs),
    import('mdx-forge/components/docusaurus').then((m) => m.TabItem),
    import('mdx-forge/components/docusaurus').then((m) => m.CodeBlock),
    import('mdx-forge/components/docusaurus').then((m) => m.Details),
  ]);

  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-docusaurus/Tabs',
    exports: createComponentModule(docusaurus_Tabs, ['Tabs']),
    aliases: ['@mdx-preview/shims/docusaurus/Tabs', '@theme/Tabs'],
  });
  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-docusaurus/TabItem',
    exports: createComponentModule(docusaurus_TabItem, ['TabItem']),
    aliases: ['@mdx-preview/shims/docusaurus/TabItem', '@theme/TabItem'],
  });
  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-docusaurus/CodeBlock',
    exports: createComponentModule(docusaurus_CodeBlock, ['CodeBlock']),
    aliases: ['@mdx-preview/shims/docusaurus/CodeBlock', '@theme/CodeBlock'],
  });
  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-docusaurus/Details',
    exports: createComponentModule(docusaurus_Details, ['Details']),
    aliases: ['@mdx-preview/shims/docusaurus/Details', '@theme/Details'],
  });
}

// lazy-load starlight shims on demand
export async function loadStarlightShims(
  registry: ModuleRegistry
): Promise<void> {
  const [
    starlight_components,
    starlight_Card,
    starlight_CardGrid,
    starlight_LinkCard,
    starlight_Steps,
    starlight_Badge,
    starlight_Aside,
    starlight_Tabs,
    starlight_TabItem,
    starlight_FileTree,
    starlight_Code,
  ] = await Promise.all([
    import('mdx-forge/components/starlight'),
    import('mdx-forge/components/starlight').then((m) => m.Card),
    import('mdx-forge/components/starlight').then((m) => m.CardGrid),
    import('mdx-forge/components/starlight').then((m) => m.LinkCard),
    import('mdx-forge/components/starlight').then((m) => m.Steps),
    import('mdx-forge/components/starlight').then((m) => m.Badge),
    import('mdx-forge/components/starlight').then((m) => m.Aside),
    import('mdx-forge/components/starlight').then((m) => m.Tabs),
    import('mdx-forge/components/starlight').then((m) => m.TabItem),
    import('mdx-forge/components/starlight').then((m) => m.FileTree),
    import('mdx-forge/components/starlight').then((m) => m.Code),
  ]);

  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-starlight/components',
    exports: createBarrelModule(starlight_components, [
      'Card',
      'CardGrid',
      'LinkCard',
      'Steps',
      'Badge',
      'Aside',
      'Tabs',
      'TabItem',
      'FileTree',
      'Code',
    ]),
    aliases: ['@astrojs/starlight/components', '@mdx-preview/shims/starlight'],
  });
  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-starlight/Card',
    exports: createComponentModule(starlight_Card, ['Card']),
    aliases: [
      '@astrojs/starlight/components/Card',
      '@mdx-preview/shims/starlight/Card',
    ],
  });
  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-starlight/CardGrid',
    exports: createComponentModule(starlight_CardGrid, ['CardGrid']),
    aliases: [
      '@astrojs/starlight/components/CardGrid',
      '@mdx-preview/shims/starlight/CardGrid',
    ],
  });
  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-starlight/LinkCard',
    exports: createComponentModule(starlight_LinkCard, ['LinkCard']),
    aliases: [
      '@astrojs/starlight/components/LinkCard',
      '@mdx-preview/shims/starlight/LinkCard',
    ],
  });
  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-starlight/Steps',
    exports: createComponentModule(starlight_Steps, ['Steps']),
    aliases: [
      '@astrojs/starlight/components/Steps',
      '@mdx-preview/shims/starlight/Steps',
    ],
  });
  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-starlight/Badge',
    exports: createComponentModule(starlight_Badge, ['Badge']),
    aliases: [
      '@astrojs/starlight/components/Badge',
      '@mdx-preview/shims/starlight/Badge',
    ],
  });
  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-starlight/Aside',
    exports: createComponentModule(starlight_Aside, ['Aside']),
    aliases: [
      '@astrojs/starlight/components/Aside',
      '@mdx-preview/shims/starlight/Aside',
    ],
  });
  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-starlight/Tabs',
    exports: createComponentModule(starlight_Tabs, ['Tabs']),
    aliases: [
      '@astrojs/starlight/components/Tabs',
      '@mdx-preview/shims/starlight/Tabs',
    ],
  });
  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-starlight/TabItem',
    exports: createComponentModule(starlight_TabItem, ['TabItem']),
    aliases: [
      '@astrojs/starlight/components/TabItem',
      '@mdx-preview/shims/starlight/TabItem',
    ],
  });
  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-starlight/FileTree',
    exports: createComponentModule(starlight_FileTree, ['FileTree']),
    aliases: [
      '@astrojs/starlight/components/FileTree',
      '@mdx-preview/shims/starlight/FileTree',
    ],
  });
  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-starlight/Code',
    exports: createComponentModule(starlight_Code, ['Code']),
    aliases: [
      '@astrojs/starlight/components/Code',
      '@mdx-preview/shims/starlight/Code',
    ],
  });
}

// lazy-load nextra shims on demand
export async function loadNextraShims(registry: ModuleRegistry): Promise<void> {
  const [
    nextra_components,
    nextra_Callout,
    nextra_Tabs,
    nextra_Cards,
    nextra_FileTree,
    nextra_Steps,
    nextra_Bleed,
  ] = await Promise.all([
    import('mdx-forge/components/nextra'),
    import('mdx-forge/components/nextra').then((m) => m.Callout),
    import('mdx-forge/components/nextra').then((m) => m.Tabs),
    import('mdx-forge/components/nextra').then((m) => m.Cards),
    import('mdx-forge/components/nextra').then((m) => m.FileTree),
    import('mdx-forge/components/nextra').then((m) => m.Steps),
    import('mdx-forge/components/nextra').then((m) => m.Bleed),
  ]);

  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-nextra/components',
    exports: createBarrelModule(nextra_components, [
      'Callout',
      'Tabs',
      'Cards',
      'FileTree',
      'Steps',
      'Bleed',
    ]),
    aliases: [
      '@mdx-preview/shims/nextra',
      'nextra-theme-docs',
      'nextra-theme-docs/components',
      'nextra/components',
    ],
  });
  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-nextra/Callout',
    exports: createComponentModule(nextra_Callout, ['Callout']),
    aliases: ['@mdx-preview/shims/nextra/Callout', 'nextra/components/Callout'],
  });
  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-nextra/Tabs',
    exports: createComponentModule(nextra_Tabs, ['Tabs']),
    aliases: ['@mdx-preview/shims/nextra/Tabs', 'nextra/components/Tabs'],
  });
  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-nextra/Cards',
    exports: createComponentModule(nextra_Cards, ['Cards']),
    aliases: ['@mdx-preview/shims/nextra/Cards', 'nextra/components/Cards'],
  });
  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-nextra/FileTree',
    exports: createComponentModule(nextra_FileTree, ['FileTree']),
    aliases: [
      '@mdx-preview/shims/nextra/FileTree',
      'nextra/components/FileTree',
    ],
  });
  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-nextra/Steps',
    exports: createComponentModule(nextra_Steps, ['Steps']),
    aliases: ['@mdx-preview/shims/nextra/Steps', 'nextra/components/Steps'],
  });
  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-nextra/Bleed',
    exports: createComponentModule(nextra_Bleed, ['Bleed']),
    aliases: ['@mdx-preview/shims/nextra/Bleed', 'nextra/components/Bleed'],
  });
}

// lazy-load nextjs shims on demand
export async function loadNextjsShims(registry: ModuleRegistry): Promise<void> {
  const [nextjs_Image, nextjs_Link] = await Promise.all([
    import('mdx-forge/components/nextjs').then((m) => m.Image),
    import('mdx-forge/components/nextjs').then((m) => m.Link),
  ]);

  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-nextjs/Image',
    exports: createComponentModule(nextjs_Image, ['Image']),
    aliases: ['@mdx-preview/shims/nextjs/Image', 'next/image'],
  });
  preloadEntry(registry, {
    id: 'npm://@mdx-preview/shims-nextjs/Link',
    exports: createComponentModule(nextjs_Link, ['Link']),
    aliases: ['@mdx-preview/shims/nextjs/Link', 'next/link'],
  });
}

// map framework name to lazy loader function
// note: 'generic' is a no-op since generic shims are loaded synchronously via preloadGenericShims
export const FRAMEWORK_LOADERS: Record<
  FrameworkId,
  (registry: ModuleRegistry) => Promise<void>
> = {
  generic: async () => {},
  docusaurus: loadDocusaurusShims,
  starlight: loadStarlightShims,
  nextra: loadNextraShims,
  nextjs: loadNextjsShims,
};
