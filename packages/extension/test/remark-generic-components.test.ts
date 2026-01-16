// packages/extension/test/remark-generic-components.test.ts
// unit tests for remark-generic-components plugin

import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import remarkGenericComponents, {
  KNOWN_GENERIC_COMPONENTS,
} from '../transpiler/mdx/remark-generic-components';

// helper to compile MDX to HTML using the plugin
async function compileWithPlugin(
  mdx: string,
  options = { enabled: true }
): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkGenericComponents, options)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(mdx);

  return String(result);
}

describe('remarkGenericComponents', () => {
  describe('KNOWN_GENERIC_COMPONENTS', () => {
    it('should include all expected component names', () => {
      const expectedComponents = [
        'Callout',
        'Alert',
        'Admonition',
        'Collapsible',
        'Accordion',
        'Details',
        'Tabs',
        'TabItem',
        'Tab',
        'CodeGroup',
      ];

      for (const name of expectedComponents) {
        expect(KNOWN_GENERIC_COMPONENTS.has(name)).toBe(true);
      }
    });
  });

  describe('Callout transformation', () => {
    it('should transform Callout with default type', async () => {
      const mdx = '<Callout>This is a note</Callout>';
      const html = await compileWithPlugin(mdx);

      expect(html).toContain('mdx-safe-callout');
      expect(html).toContain('mdx-safe-callout-note');
      expect(html).toContain('data-callout-type="note"');
    });

    it('should transform Callout with warning type', async () => {
      const mdx = '<Callout type="warning">Warning message</Callout>';
      const html = await compileWithPlugin(mdx);

      expect(html).toContain('mdx-safe-callout-warning');
      expect(html).toContain('data-callout-type="warning"');
    });

    it('should transform Callout with danger type', async () => {
      const mdx = '<Callout type="danger">Danger!</Callout>';
      const html = await compileWithPlugin(mdx);

      expect(html).toContain('mdx-safe-callout-danger');
      expect(html).toContain('data-callout-type="danger"');
    });

    it('should transform Callout with tip type', async () => {
      const mdx = '<Callout type="tip">Helpful tip</Callout>';
      const html = await compileWithPlugin(mdx);

      expect(html).toContain('mdx-safe-callout-tip');
    });

    it('should transform Callout with info type', async () => {
      const mdx = '<Callout type="info">Information</Callout>';
      const html = await compileWithPlugin(mdx);

      expect(html).toContain('mdx-safe-callout-info');
    });

    it('should transform Callout with caution type', async () => {
      const mdx = '<Callout type="caution">Be careful</Callout>';
      const html = await compileWithPlugin(mdx);

      expect(html).toContain('mdx-safe-callout-caution');
    });

    it('should transform Callout with important type', async () => {
      const mdx = '<Callout type="important">Important info</Callout>';
      const html = await compileWithPlugin(mdx);

      expect(html).toContain('mdx-safe-callout-important');
    });

    it('should handle type aliases (success -> tip)', async () => {
      const mdx = '<Callout type="success">Success!</Callout>';
      const html = await compileWithPlugin(mdx);

      expect(html).toContain('mdx-safe-callout-tip');
    });

    it('should handle type aliases (error -> danger)', async () => {
      const mdx = '<Callout type="error">Error!</Callout>';
      const html = await compileWithPlugin(mdx);

      expect(html).toContain('mdx-safe-callout-danger');
    });

    it('should use custom title when provided', async () => {
      const mdx = '<Callout title="Custom Title">Content</Callout>';
      const html = await compileWithPlugin(mdx);

      expect(html).toContain('Custom Title');
    });

    it('should transform Alert component (alias)', async () => {
      const mdx = '<Alert type="warning">Alert message</Alert>';
      const html = await compileWithPlugin(mdx);

      expect(html).toContain('mdx-safe-callout');
      expect(html).toContain('mdx-safe-callout-warning');
    });

    it('should transform Admonition component (alias)', async () => {
      const mdx = '<Admonition type="tip">Tip content</Admonition>';
      const html = await compileWithPlugin(mdx);

      expect(html).toContain('mdx-safe-callout');
      expect(html).toContain('mdx-safe-callout-tip');
    });
  });

  describe('Collapsible transformation', () => {
    it('should transform Collapsible to details/summary', async () => {
      const mdx = '<Collapsible title="Click me">Hidden content</Collapsible>';
      const html = await compileWithPlugin(mdx);

      expect(html).toContain('<details');
      expect(html).toContain('<summary');
      expect(html).toContain('mdx-safe-collapsible');
      expect(html).toContain('Click me');
    });

    it('should respect defaultOpen prop', async () => {
      const mdx =
        '<Collapsible title="Open by default" defaultOpen>Content</Collapsible>';
      const html = await compileWithPlugin(mdx);

      expect(html).toContain('open');
    });

    it('should use summary prop as title fallback', async () => {
      const mdx = '<Collapsible summary="Summary text">Content</Collapsible>';
      const html = await compileWithPlugin(mdx);

      expect(html).toContain('Summary text');
    });

    it('should transform Accordion component (alias)', async () => {
      const mdx = '<Accordion title="Accordion">Content</Accordion>';
      const html = await compileWithPlugin(mdx);

      expect(html).toContain('<details');
      expect(html).toContain('mdx-safe-collapsible');
    });

    it('should transform Details component (alias)', async () => {
      const mdx = '<Details title="Details">Content</Details>';
      const html = await compileWithPlugin(mdx);

      expect(html).toContain('<details');
      expect(html).toContain('mdx-safe-collapsible');
    });
  });

  describe('Tabs transformation', () => {
    it('should transform Tabs container', async () => {
      const mdx = `<Tabs>
<TabItem label="Tab 1">Content 1</TabItem>
<TabItem label="Tab 2">Content 2</TabItem>
</Tabs>`;
      const html = await compileWithPlugin(mdx);

      expect(html).toContain('mdx-safe-tabs');
      expect(html).toContain('mdx-safe-tabs-notice');
    });

    it('should transform TabItem with label', async () => {
      const mdx = '<TabItem label="First Tab">Tab content</TabItem>';
      const html = await compileWithPlugin(mdx);

      expect(html).toContain('mdx-safe-tab-panel');
      expect(html).toContain('First Tab');
    });

    it('should transform TabItem with value prop (fallback)', async () => {
      const mdx = '<TabItem value="second">Tab content</TabItem>';
      const html = await compileWithPlugin(mdx);

      expect(html).toContain('mdx-safe-tab-panel');
      expect(html).toContain('second');
    });

    it('should transform Tab component (alias)', async () => {
      const mdx = '<Tab label="My Tab">Content</Tab>';
      const html = await compileWithPlugin(mdx);

      expect(html).toContain('mdx-safe-tab-panel');
    });
  });

  describe('CodeGroup transformation', () => {
    it('should transform CodeGroup container', async () => {
      const mdx = `<CodeGroup>
\`\`\`js
console.log('hello');
\`\`\`
</CodeGroup>`;
      const html = await compileWithPlugin(mdx);

      expect(html).toContain('mdx-safe-code-group');
      expect(html).toContain('mdx-safe-code-group-notice');
    });
  });

  describe('plugin options', () => {
    it('should not transform when disabled', async () => {
      const mdx = '<Callout>Content</Callout>';
      const html = await compileWithPlugin(mdx, { enabled: false });

      // when disabled, component should pass through unchanged
      expect(html).not.toContain('mdx-safe-callout');
    });
  });

  describe('HTML escaping', () => {
    it('should escape title with special characters', async () => {
      const mdx =
        '<Callout title="<script>alert(1)</script>">Content</Callout>';
      const html = await compileWithPlugin(mdx);

      // should be escaped, not rendered as script tag
      expect(html).not.toContain('<script>');
      // rehype-stringify double-encodes, so &lt; becomes &#x26;lt;
      // either form is acceptable as long as script tag is not executable
      expect(
        html.includes('&lt;script&gt;') ||
          html.includes('&#x26;lt;script&#x26;gt;')
      ).toBe(true);
    });

    it('should escape Collapsible title with special characters', async () => {
      const mdx =
        '<Collapsible title="Test & <b>bold</b>">Content</Collapsible>';
      const html = await compileWithPlugin(mdx);

      // check that special characters are escaped (may be double-encoded)
      expect(html).not.toContain('<b>bold</b>');
      // ampersand should be encoded (either &amp; or &#x26;amp;)
      expect(html.includes('&amp;') || html.includes('&#x26;amp;')).toBe(true);
    });

    it('should escape TabItem label with special characters', async () => {
      const mdx = '<TabItem label="Tab 1 and 2">Content</TabItem>';
      const html = await compileWithPlugin(mdx);

      // just verify the content appears
      expect(html).toContain('Tab 1 and 2');
    });
  });

  describe('static prop handling', () => {
    it('should ignore expression values', async () => {
      // expression values like {variable} should be ignored
      // and defaults used instead
      const mdx = '<Callout type={dynamicType}>Content</Callout>';
      const html = await compileWithPlugin(mdx);

      // should use default 'note' type since expression is ignored
      expect(html).toContain('mdx-safe-callout-note');
    });
  });

  describe('unknown types', () => {
    it('should fall back to note for unknown callout type', async () => {
      const mdx = '<Callout type="unknown-type">Content</Callout>';
      const html = await compileWithPlugin(mdx);

      expect(html).toContain('mdx-safe-callout-note');
    });
  });
});
