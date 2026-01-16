// packages/webview-app/src/test/preload-parity.test.ts
// Tests to ensure webview preload aliases stay in sync with shared-types

import { describe, it, expect } from 'vitest';
import {
  PRELOADED_IDS,
  PRELOAD_ALIASES,
  getPreservedIds,
  validateRegistryParity,
} from '../module-loader/preload-aliases';
import {
  GENERIC_COMPONENTS,
  FRAMEWORK_COMPONENTS,
  getAllGenericComponentNames,
  getPrimaryGenericComponentNames,
} from '@mdx-preview/shared-types';

describe('Preload Aliases Parity', () => {
  describe('validateRegistryParity', () => {
    it('returns valid with no missing components', () => {
      const result = validateRegistryParity();
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('would detect missing components', () => {
      // This test documents the expected behavior
      // If a component is added to shared-types but not preload-aliases,
      // validateRegistryParity would return { valid: false, missing: [...] }
      const result = validateRegistryParity();
      if (!result.valid) {
        console.error('Missing components:', result.missing);
      }
      expect(result.valid).toBe(true);
    });
  });

  describe('PRELOADED_IDS coverage', () => {
    describe('generic components', () => {
      it('has preloaded ID for Callout', () => {
        expect(PRELOADED_IDS.genericCallout).toBeDefined();
        expect(PRELOADED_IDS.genericCallout).toContain('Callout');
      });

      it('has preloaded ID for Alert (Callout alias)', () => {
        expect(PRELOADED_IDS.genericAlert).toBeDefined();
        expect(PRELOADED_IDS.genericAlert).toContain('Alert');
      });

      it('has preloaded ID for Admonition (Callout alias)', () => {
        expect(PRELOADED_IDS.genericAdmonition).toBeDefined();
        expect(PRELOADED_IDS.genericAdmonition).toContain('Admonition');
      });

      it('has preloaded ID for Collapsible', () => {
        expect(PRELOADED_IDS.genericCollapsible).toBeDefined();
        expect(PRELOADED_IDS.genericCollapsible).toContain('Collapsible');
      });

      it('has preloaded ID for Accordion (Collapsible alias)', () => {
        expect(PRELOADED_IDS.genericAccordion).toBeDefined();
        expect(PRELOADED_IDS.genericAccordion).toContain('Accordion');
      });

      it('has preloaded ID for Details (Collapsible alias)', () => {
        expect(PRELOADED_IDS.genericDetails).toBeDefined();
        expect(PRELOADED_IDS.genericDetails).toContain('Details');
      });

      it('has preloaded ID for Tabs', () => {
        expect(PRELOADED_IDS.genericTabs).toBeDefined();
        expect(PRELOADED_IDS.genericTabs).toContain('Tabs');
      });

      it('has preloaded ID for TabItem', () => {
        expect(PRELOADED_IDS.genericTabItem).toBeDefined();
        expect(PRELOADED_IDS.genericTabItem).toContain('TabItem');
      });

      it('has preloaded ID for Tab (TabItem alias)', () => {
        expect(PRELOADED_IDS.genericTab).toBeDefined();
        expect(PRELOADED_IDS.genericTab).toContain('Tab');
      });

      it('has preloaded ID for CodeGroup', () => {
        expect(PRELOADED_IDS.genericCodeGroup).toBeDefined();
        expect(PRELOADED_IDS.genericCodeGroup).toContain('CodeGroup');
      });
    });

    describe('Docusaurus components', () => {
      it('has all 4 Docusaurus components', () => {
        expect(PRELOADED_IDS.docusaurusTabs).toBeDefined();
        expect(PRELOADED_IDS.docusaurusTabItem).toBeDefined();
        expect(PRELOADED_IDS.docusaurusCodeBlock).toBeDefined();
        expect(PRELOADED_IDS.docusaurusDetails).toBeDefined();
      });

      it('component count matches FRAMEWORK_COMPONENTS', () => {
        const docusaurusIds = Object.entries(PRELOADED_IDS).filter(([key]) =>
          key.startsWith('docusaurus')
        );
        expect(docusaurusIds.length).toBe(
          FRAMEWORK_COMPONENTS.docusaurus.length
        );
      });
    });

    describe('Starlight components', () => {
      it('has all 10 Starlight components', () => {
        expect(PRELOADED_IDS.starlightCard).toBeDefined();
        expect(PRELOADED_IDS.starlightCardGrid).toBeDefined();
        expect(PRELOADED_IDS.starlightLinkCard).toBeDefined();
        expect(PRELOADED_IDS.starlightSteps).toBeDefined();
        expect(PRELOADED_IDS.starlightBadge).toBeDefined();
        expect(PRELOADED_IDS.starlightAside).toBeDefined();
        expect(PRELOADED_IDS.starlightTabs).toBeDefined();
        expect(PRELOADED_IDS.starlightTabItem).toBeDefined();
        expect(PRELOADED_IDS.starlightFileTree).toBeDefined();
        expect(PRELOADED_IDS.starlightCode).toBeDefined();
      });

      it('component count matches FRAMEWORK_COMPONENTS', () => {
        const starlightIds = Object.entries(PRELOADED_IDS).filter(([key]) =>
          key.startsWith('starlight')
        );
        // Starlight has components entry plus individual components
        expect(starlightIds.length).toBe(
          FRAMEWORK_COMPONENTS.starlight.length + 1
        ); // +1 for starlightComponents
      });
    });

    describe('Next.js components', () => {
      it('has all 2 Next.js components', () => {
        expect(PRELOADED_IDS.nextjsImage).toBeDefined();
        expect(PRELOADED_IDS.nextjsLink).toBeDefined();
      });

      it('component count matches FRAMEWORK_COMPONENTS', () => {
        const nextjsIds = Object.entries(PRELOADED_IDS).filter(([key]) =>
          key.startsWith('nextjs')
        );
        expect(nextjsIds.length).toBe(FRAMEWORK_COMPONENTS.nextjs.length);
      });
    });
  });

  describe('PRELOAD_ALIASES coverage', () => {
    describe('direct component name aliases', () => {
      it('has direct Callout alias', () => {
        expect(PRELOAD_ALIASES.Callout).toBe(PRELOADED_IDS.genericCallout);
      });

      it('has direct Alert alias', () => {
        expect(PRELOAD_ALIASES.Alert).toBe(PRELOADED_IDS.genericAlert);
      });

      it('has direct Admonition alias', () => {
        expect(PRELOAD_ALIASES.Admonition).toBe(
          PRELOADED_IDS.genericAdmonition
        );
      });

      it('has direct Collapsible alias', () => {
        expect(PRELOAD_ALIASES.Collapsible).toBe(
          PRELOADED_IDS.genericCollapsible
        );
      });

      it('has direct Accordion alias', () => {
        expect(PRELOAD_ALIASES.Accordion).toBe(PRELOADED_IDS.genericAccordion);
      });

      it('has direct Details alias', () => {
        expect(PRELOAD_ALIASES.Details).toBe(PRELOADED_IDS.genericDetails);
      });

      it('has direct CodeGroup alias', () => {
        expect(PRELOAD_ALIASES.CodeGroup).toBe(PRELOADED_IDS.genericCodeGroup);
      });
    });

    describe('@mdx-preview/shims/* aliases', () => {
      it('has @mdx-preview/shims/generic/* paths', () => {
        expect(PRELOAD_ALIASES['@mdx-preview/shims/generic/Callout']).toBe(
          PRELOADED_IDS.genericCallout
        );
        expect(PRELOAD_ALIASES['@mdx-preview/shims/generic/Alert']).toBe(
          PRELOADED_IDS.genericAlert
        );
        expect(PRELOAD_ALIASES['@mdx-preview/shims/generic/Collapsible']).toBe(
          PRELOADED_IDS.genericCollapsible
        );
        expect(PRELOAD_ALIASES['@mdx-preview/shims/generic/Accordion']).toBe(
          PRELOADED_IDS.genericAccordion
        );
        expect(PRELOAD_ALIASES['@mdx-preview/shims/generic/Details']).toBe(
          PRELOADED_IDS.genericDetails
        );
        expect(PRELOAD_ALIASES['@mdx-preview/shims/generic/Tabs']).toBe(
          PRELOADED_IDS.genericTabs
        );
        expect(PRELOAD_ALIASES['@mdx-preview/shims/generic/TabItem']).toBe(
          PRELOADED_IDS.genericTabItem
        );
        expect(PRELOAD_ALIASES['@mdx-preview/shims/generic/Tab']).toBe(
          PRELOADED_IDS.genericTab
        );
        expect(PRELOAD_ALIASES['@mdx-preview/shims/generic/CodeGroup']).toBe(
          PRELOADED_IDS.genericCodeGroup
        );
      });
    });

    describe('Docusaurus @theme/* aliases', () => {
      it('has @theme/Tabs alias', () => {
        expect(PRELOAD_ALIASES['@theme/Tabs']).toBe(
          PRELOADED_IDS.docusaurusTabs
        );
      });

      it('has @theme/TabItem alias', () => {
        expect(PRELOAD_ALIASES['@theme/TabItem']).toBe(
          PRELOADED_IDS.docusaurusTabItem
        );
      });

      it('has @theme/CodeBlock alias', () => {
        expect(PRELOAD_ALIASES['@theme/CodeBlock']).toBe(
          PRELOADED_IDS.docusaurusCodeBlock
        );
      });

      it('has @theme/Details alias', () => {
        expect(PRELOAD_ALIASES['@theme/Details']).toBe(
          PRELOADED_IDS.docusaurusDetails
        );
      });
    });

    describe('Starlight @astrojs/* aliases', () => {
      it('has @astrojs/starlight/components alias', () => {
        expect(PRELOAD_ALIASES['@astrojs/starlight/components']).toBe(
          PRELOADED_IDS.starlightComponents
        );
      });
    });

    describe('Next.js aliases', () => {
      it('has next/image alias', () => {
        expect(PRELOAD_ALIASES['next/image']).toBe(PRELOADED_IDS.nextjsImage);
      });

      it('has next/link alias', () => {
        expect(PRELOAD_ALIASES['next/link']).toBe(PRELOADED_IDS.nextjsLink);
      });
    });
  });

  describe('getPreservedIds', () => {
    it('includes all preloaded IDs', () => {
      const preserved = getPreservedIds();
      const preloadedValues = Object.values(PRELOADED_IDS);

      for (const id of preloadedValues) {
        expect(preserved).toContain(id);
      }
    });

    it('includes short-form aliases for generic components', () => {
      const preserved = getPreservedIds();

      expect(preserved).toContain('Callout');
      expect(preserved).toContain('Alert');
      expect(preserved).toContain('Admonition');
      expect(preserved).toContain('Collapsible');
      expect(preserved).toContain('Accordion');
      expect(preserved).toContain('Details');
      expect(preserved).toContain('CodeGroup');
    });

    it('includes framework-specific aliases', () => {
      const preserved = getPreservedIds();

      expect(preserved).toContain('@theme/Tabs');
      expect(preserved).toContain('@theme/TabItem');
      expect(preserved).toContain('@theme/CodeBlock');
      expect(preserved).toContain('@theme/Details');
      expect(preserved).toContain('@astrojs/starlight/components');
      expect(preserved).toContain('next/image');
      expect(preserved).toContain('next/link');
    });
  });

  describe('Shared Registry Integration', () => {
    it('all generic component names have matching preload IDs', () => {
      const primaryNames = getPrimaryGenericComponentNames();

      for (const name of primaryNames) {
        const key = `generic${name}` as keyof typeof PRELOADED_IDS;
        expect(PRELOADED_IDS[key]).toBeDefined();
      }
    });

    it('all generic aliases have matching preload IDs', () => {
      for (const [primary, config] of Object.entries(GENERIC_COMPONENTS)) {
        for (const alias of config.aliases) {
          const key = `generic${alias}` as keyof typeof PRELOADED_IDS;
          expect(PRELOADED_IDS[key]).toBeDefined();
        }
      }
    });

    it('all Docusaurus components have matching preload IDs', () => {
      for (const component of FRAMEWORK_COMPONENTS.docusaurus) {
        const key = `docusaurus${component}` as keyof typeof PRELOADED_IDS;
        expect(PRELOADED_IDS[key]).toBeDefined();
      }
    });

    it('all Starlight components have matching preload IDs', () => {
      for (const component of FRAMEWORK_COMPONENTS.starlight) {
        const key = `starlight${component}` as keyof typeof PRELOADED_IDS;
        expect(PRELOADED_IDS[key]).toBeDefined();
      }
    });

    it('all Next.js components have matching preload IDs', () => {
      for (const component of FRAMEWORK_COMPONENTS.nextjs) {
        const key = `nextjs${component}` as keyof typeof PRELOADED_IDS;
        expect(PRELOADED_IDS[key]).toBeDefined();
      }
    });
  });
});
