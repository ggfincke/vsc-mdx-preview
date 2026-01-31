// AUTO-GENERATED FILE - DO NOT EDIT
// Source: packages/shared/registry/registry-data.ts

import type { ModuleRegistry } from '../registry/ModuleRegistry';
import { createBarrelModule, createComponentModule } from './core';
import type { FrameworkId } from '@mdx-preview/shared';

// static imports for generic shims
import generic_Callout from '../../components/shims/generic/Callout';
import generic_Collapsible from '../../components/shims/generic/Collapsible';
import generic_Tabs from '../../components/shims/generic/Tabs';
import generic_TabItem from '../../components/shims/generic/TabItem';
import generic_CodeGroup from '../../components/shims/generic/CodeGroup';

// preload generic shims synchronously
export function preloadGenericShims(registry: ModuleRegistry): void {
  registry.preload(
    'npm://@mdx-preview/shims-generic/Callout',
    createComponentModule(generic_Callout, ['Callout', 'Alert', 'Admonition'])
  );
  registry.preload(
    'npm://@mdx-preview/shims-generic/Collapsible',
    createComponentModule(generic_Collapsible, [
      'Collapsible',
      'Accordion',
      'Details',
    ])
  );
  registry.preload(
    'npm://@mdx-preview/shims-generic/Tabs',
    createComponentModule(generic_Tabs, ['Tabs'])
  );
  registry.preload(
    'npm://@mdx-preview/shims-generic/TabItem',
    createComponentModule(generic_TabItem, ['TabItem', 'Tab'])
  );
  registry.preload(
    'npm://@mdx-preview/shims-generic/CodeGroup',
    createComponentModule(generic_CodeGroup, ['CodeGroup'])
  );
}

// individual lazy loaders for conditional generic shim preloading
export const GENERIC_SHIM_LOADERS: Record<
  string,
  (registry: ModuleRegistry) => Promise<void>
> = {
  Callout: async (registry: ModuleRegistry) => {
    const component =
      await import('../../components/shims/generic/Callout').then(
        (m) => m.default
      );
    registry.preload(
      'npm://@mdx-preview/shims-generic/Callout',
      createComponentModule(component, ['Callout', 'Alert', 'Admonition'])
    );
  },
  Collapsible: async (registry: ModuleRegistry) => {
    const component =
      await import('../../components/shims/generic/Collapsible').then(
        (m) => m.default
      );
    registry.preload(
      'npm://@mdx-preview/shims-generic/Collapsible',
      createComponentModule(component, ['Collapsible', 'Accordion', 'Details'])
    );
  },
  Tabs: async (registry: ModuleRegistry) => {
    const component = await import('../../components/shims/generic/Tabs').then(
      (m) => m.default
    );
    registry.preload(
      'npm://@mdx-preview/shims-generic/Tabs',
      createComponentModule(component, ['Tabs'])
    );
  },
  TabItem: async (registry: ModuleRegistry) => {
    const component =
      await import('../../components/shims/generic/TabItem').then(
        (m) => m.default
      );
    registry.preload(
      'npm://@mdx-preview/shims-generic/TabItem',
      createComponentModule(component, ['TabItem', 'Tab'])
    );
  },
  CodeGroup: async (registry: ModuleRegistry) => {
    const component =
      await import('../../components/shims/generic/CodeGroup').then(
        (m) => m.default
      );
    registry.preload(
      'npm://@mdx-preview/shims-generic/CodeGroup',
      createComponentModule(component, ['CodeGroup'])
    );
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
    import('../../components/shims/docusaurus/Tabs').then((m) => m.default),
    import('../../components/shims/docusaurus/Tabs').then((m) => m.TabItem),
    import('../../components/shims/docusaurus/CodeBlock').then(
      (m) => m.default
    ),
    import('../../components/shims/docusaurus/Details').then((m) => m.default),
  ]);

  registry.preload(
    'npm://@mdx-preview/shims-docusaurus/Tabs',
    createComponentModule(docusaurus_Tabs, ['Tabs'])
  );
  registry.preload(
    'npm://@mdx-preview/shims-docusaurus/TabItem',
    createComponentModule(docusaurus_TabItem, ['TabItem'])
  );
  registry.preload(
    'npm://@mdx-preview/shims-docusaurus/CodeBlock',
    createComponentModule(docusaurus_CodeBlock, ['CodeBlock'])
  );
  registry.preload(
    'npm://@mdx-preview/shims-docusaurus/Details',
    createComponentModule(docusaurus_Details, ['Details'])
  );
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
    import('../../components/shims/starlight'),
    import('../../components/shims/starlight/Card').then((m) => m.default),
    import('../../components/shims/starlight/CardGrid').then((m) => m.default),
    import('../../components/shims/starlight/LinkCard').then((m) => m.default),
    import('../../components/shims/starlight/Steps').then((m) => m.default),
    import('../../components/shims/starlight/Badge').then((m) => m.default),
    import('../../components/shims/starlight/Aside').then((m) => m.default),
    import('../../components/shims/starlight/Tabs').then((m) => m.Tabs),
    import('../../components/shims/starlight/Tabs').then((m) => m.TabItem),
    import('../../components/shims/starlight/FileTree').then((m) => m.default),
    import('../../components/shims/starlight/Code').then((m) => m.default),
  ]);

  registry.preload(
    'npm://@mdx-preview/shims-starlight/components',
    createBarrelModule(starlight_components, [
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
    ])
  );
  registry.preload(
    'npm://@mdx-preview/shims-starlight/Card',
    createComponentModule(starlight_Card, ['Card'])
  );
  registry.preload(
    'npm://@mdx-preview/shims-starlight/CardGrid',
    createComponentModule(starlight_CardGrid, ['CardGrid'])
  );
  registry.preload(
    'npm://@mdx-preview/shims-starlight/LinkCard',
    createComponentModule(starlight_LinkCard, ['LinkCard'])
  );
  registry.preload(
    'npm://@mdx-preview/shims-starlight/Steps',
    createComponentModule(starlight_Steps, ['Steps'])
  );
  registry.preload(
    'npm://@mdx-preview/shims-starlight/Badge',
    createComponentModule(starlight_Badge, ['Badge'])
  );
  registry.preload(
    'npm://@mdx-preview/shims-starlight/Aside',
    createComponentModule(starlight_Aside, ['Aside'])
  );
  registry.preload(
    'npm://@mdx-preview/shims-starlight/Tabs',
    createComponentModule(starlight_Tabs, ['Tabs'])
  );
  registry.preload(
    'npm://@mdx-preview/shims-starlight/TabItem',
    createComponentModule(starlight_TabItem, ['TabItem'])
  );
  registry.preload(
    'npm://@mdx-preview/shims-starlight/FileTree',
    createComponentModule(starlight_FileTree, ['FileTree'])
  );
  registry.preload(
    'npm://@mdx-preview/shims-starlight/Code',
    createComponentModule(starlight_Code, ['Code'])
  );
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
    import('../../components/shims/nextra'),
    import('../../components/shims/nextra/Callout').then((m) => m.default),
    import('../../components/shims/nextra/Tabs').then((m) => m.default),
    import('../../components/shims/nextra/Cards').then((m) => m.default),
    import('../../components/shims/nextra/FileTree').then((m) => m.default),
    import('../../components/shims/nextra/Steps').then((m) => m.default),
    import('../../components/shims/nextra/Bleed').then((m) => m.default),
  ]);

  registry.preload(
    'npm://@mdx-preview/shims-nextra/components',
    createBarrelModule(nextra_components, [
      'Callout',
      'Tabs',
      'Cards',
      'FileTree',
      'Steps',
      'Bleed',
    ])
  );
  registry.preload(
    'npm://@mdx-preview/shims-nextra/Callout',
    createComponentModule(nextra_Callout, ['Callout'])
  );
  registry.preload(
    'npm://@mdx-preview/shims-nextra/Tabs',
    createComponentModule(nextra_Tabs, ['Tabs'])
  );
  registry.preload(
    'npm://@mdx-preview/shims-nextra/Cards',
    createComponentModule(nextra_Cards, ['Cards'])
  );
  registry.preload(
    'npm://@mdx-preview/shims-nextra/FileTree',
    createComponentModule(nextra_FileTree, ['FileTree'])
  );
  registry.preload(
    'npm://@mdx-preview/shims-nextra/Steps',
    createComponentModule(nextra_Steps, ['Steps'])
  );
  registry.preload(
    'npm://@mdx-preview/shims-nextra/Bleed',
    createComponentModule(nextra_Bleed, ['Bleed'])
  );
}

// lazy-load nextjs shims on demand
export async function loadNextjsShims(registry: ModuleRegistry): Promise<void> {
  const [nextjs_Image, nextjs_Link] = await Promise.all([
    import('../../components/shims/nextjs/Image').then((m) => m.default),
    import('../../components/shims/nextjs/Link').then((m) => m.default),
  ]);

  registry.preload(
    'npm://@mdx-preview/shims-nextjs/Image',
    createComponentModule(nextjs_Image, ['Image'])
  );
  registry.preload(
    'npm://@mdx-preview/shims-nextjs/Link',
    createComponentModule(nextjs_Link, ['Link'])
  );
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
