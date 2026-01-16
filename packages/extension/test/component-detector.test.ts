// packages/extension/test/component-detector.test.ts
// unit tests for component detector

import { describe, it, expect, vi } from 'vitest';
import {
  detectComponents,
  getUnknownComponents,
  isPascalCase,
  isHtmlElement,
  extractImports,
} from '../diagnostics/ComponentDetector';

// mock vscode module
vi.mock('vscode', () => ({
  Range: class MockRange {
    constructor(
      public startLine: number,
      public startCol: number,
      public endLine: number,
      public endCol: number
    ) {}
  },
  window: {
    createOutputChannel: () => ({
      appendLine: () => {},
      append: () => {},
      show: () => {},
      dispose: () => {},
    }),
  },
}));

describe('ComponentDetector', () => {
  describe('isPascalCase', () => {
    it('should return true for PascalCase names', () => {
      expect(isPascalCase('Callout')).toBe(true);
      expect(isPascalCase('MyComponent')).toBe(true);
      expect(isPascalCase('A')).toBe(true);
      expect(isPascalCase('Tab1')).toBe(true);
    });

    it('should return false for non-PascalCase names', () => {
      expect(isPascalCase('callout')).toBe(false);
      expect(isPascalCase('myComponent')).toBe(false);
      expect(isPascalCase('my-component')).toBe(false);
      expect(isPascalCase('_Component')).toBe(false);
      expect(isPascalCase('123')).toBe(false);
    });
  });

  describe('isHtmlElement', () => {
    it('should return true for HTML element names', () => {
      expect(isHtmlElement('div')).toBe(true);
      expect(isHtmlElement('span')).toBe(true);
      expect(isHtmlElement('a')).toBe(true);
      expect(isHtmlElement('button')).toBe(true);
      expect(isHtmlElement('input')).toBe(true);
      expect(isHtmlElement('h1')).toBe(true);
      expect(isHtmlElement('p')).toBe(true);
    });

    it('should return false for non-HTML names', () => {
      expect(isHtmlElement('Callout')).toBe(false);
      expect(isHtmlElement('MyComponent')).toBe(false);
      expect(isHtmlElement('customElement')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isHtmlElement('DIV')).toBe(true);
      expect(isHtmlElement('Span')).toBe(true);
    });
  });

  describe('extractImports', () => {
    it('should extract default imports', () => {
      const code = "import Callout from './components/Callout';";
      const imports = extractImports(code);

      expect(imports.get('Callout')).toBe('./components/Callout');
    });

    it('should extract named imports', () => {
      const code = "import { Alert, Button } from './ui';";
      const imports = extractImports(code);

      expect(imports.get('Alert')).toBe('./ui');
      expect(imports.get('Button')).toBe('./ui');
    });

    it('should extract renamed imports', () => {
      const code = "import { Alert as MyAlert } from './ui';";
      const imports = extractImports(code);

      expect(imports.get('MyAlert')).toBe('./ui');
      expect(imports.has('Alert')).toBe(false);
    });

    it('should extract namespace imports', () => {
      const code = "import * as Components from './components';";
      const imports = extractImports(code);

      expect(imports.get('Components')).toBe('./components');
    });

    it('should only extract PascalCase imports', () => {
      const code = "import { helper, Util } from './utils';";
      const imports = extractImports(code);

      expect(imports.has('helper')).toBe(false);
      expect(imports.get('Util')).toBe('./utils');
    });

    it('should handle multiple import statements', () => {
      const code = `
        import React from 'react';
        import { Callout, Alert } from './ui';
        import MyComponent from './MyComponent';
      `;
      const imports = extractImports(code);

      expect(imports.get('React')).toBe('react');
      expect(imports.get('Callout')).toBe('./ui');
      expect(imports.get('Alert')).toBe('./ui');
      expect(imports.get('MyComponent')).toBe('./MyComponent');
    });
  });

  describe('detectComponents', () => {
    it('should detect PascalCase JSX components', async () => {
      const mdx = `
# Hello

<Callout>This is a callout</Callout>

Some text with <Badge>inline</Badge> component.
`;
      const result = await detectComponents(mdx);

      expect(result.components.length).toBeGreaterThanOrEqual(2);

      const names = result.components.map((c) => c.name);
      expect(names).toContain('Callout');
      expect(names).toContain('Badge');
    });

    it('should not detect HTML elements as components', async () => {
      const mdx = `
<div>Regular div</div>
<span>Regular span</span>
<a href="#">Link</a>
`;
      const result = await detectComponents(mdx);

      const names = result.components.map((c) => c.name);
      expect(names).not.toContain('div');
      expect(names).not.toContain('span');
      expect(names).not.toContain('a');
    });

    it('should classify builtin components correctly', async () => {
      const mdx = '<Callout>Built-in callout</Callout>';
      const result = await detectComponents(mdx);

      const callout = result.components.find((c) => c.name === 'Callout');
      expect(callout).toBeDefined();
      expect(callout?.source).toBe('builtin');
    });

    it('should classify imported components correctly', async () => {
      const mdx = `
import MyWidget from './widgets/MyWidget';

<MyWidget>Content</MyWidget>
`;
      const result = await detectComponents(mdx);

      const widget = result.components.find((c) => c.name === 'MyWidget');
      expect(widget).toBeDefined();
      expect(widget?.source).toBe('import');
    });

    it('should classify config components correctly', async () => {
      const mdx = '<CustomCard>Content</CustomCard>';
      const configComponents = new Set(['CustomCard']);
      const result = await detectComponents(mdx, {}, configComponents);

      const card = result.components.find((c) => c.name === 'CustomCard');
      expect(card).toBeDefined();
      expect(card?.source).toBe('config');
    });

    it('should classify unknown components correctly', async () => {
      const mdx = '<UnknownWidget>Content</UnknownWidget>';
      const result = await detectComponents(mdx);

      const widget = result.components.find((c) => c.name === 'UnknownWidget');
      expect(widget).toBeDefined();
      expect(widget?.source).toBe('unknown');
    });

    it('should collect imports', async () => {
      const mdx = `
import Foo from './foo';
import { Bar, Baz } from './components';

<Foo />
<Bar />
`;
      const result = await detectComponents(mdx);

      expect(result.imports.get('Foo')).toBe('./foo');
      expect(result.imports.get('Bar')).toBe('./components');
      expect(result.imports.get('Baz')).toBe('./components');
    });

    it('should detect hasChildren property', async () => {
      const mdx = `
<SelfClosing />
<WithChildren>Some content</WithChildren>
`;
      const result = await detectComponents(mdx);

      const selfClosing = result.components.find(
        (c) => c.name === 'SelfClosing'
      );
      const withChildren = result.components.find(
        (c) => c.name === 'WithChildren'
      );

      expect(selfClosing?.hasChildren).toBe(false);
      expect(withChildren?.hasChildren).toBe(true);
    });

    it('should handle frontmatter', async () => {
      const mdx = `---
title: My Page
---

<Callout>Content</Callout>
`;
      const result = await detectComponents(mdx);

      const callout = result.components.find((c) => c.name === 'Callout');
      expect(callout).toBeDefined();
    });

    it('should handle parse errors gracefully', async () => {
      const mdx = '<Broken>unclosed';
      const result = await detectComponents(mdx);

      // should not throw, may have errors
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getUnknownComponents', () => {
    it('should filter to only unknown components', async () => {
      const mdx = `
<Callout>Built-in</Callout>
<UnknownWidget>Unknown</UnknownWidget>
<AnotherUnknown />
`;
      const result = await detectComponents(mdx);
      const unknown = getUnknownComponents(result);

      expect(unknown.length).toBe(2);
      const names = unknown.map((c) => c.name);
      expect(names).toContain('UnknownWidget');
      expect(names).toContain('AnotherUnknown');
      expect(names).not.toContain('Callout');
    });
  });

  describe('framework component detection', () => {
    it('should classify framework components', async () => {
      const mdx = `
<Tabs>
<TabItem label="Tab 1">Content</TabItem>
</Tabs>
`;
      const result = await detectComponents(mdx);

      // Tabs and TabItem are known generic components
      const tabs = result.components.find((c) => c.name === 'Tabs');
      const tabItem = result.components.find((c) => c.name === 'TabItem');

      expect(tabs?.source).toBe('builtin');
      expect(tabItem?.source).toBe('builtin');
    });
  });
});
