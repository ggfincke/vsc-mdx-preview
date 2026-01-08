// packages/extension/test/rehype-shiki.test.ts
// tests for rehype-shiki helpers

import { describe, it, expect } from 'vitest';
import { visit } from 'unist-util-visit';
import type { Node } from 'unist';
import {
  styleStringToObject,
  htmlToHastFragment,
} from '../transpiler/mdx/rehype-shiki-helpers';

describe('styleStringToObject', () => {
  it('converts normal CSS properties to camelCase', () => {
    const result = styleStringToObject('color: red; font-size: 12px');
    expect(result).toEqual({ color: 'red', fontSize: '12px' });
  });

  it('preserves CSS custom properties', () => {
    const result = styleStringToObject(
      '--shiki-dark: #fff; background-color: #000'
    );
    expect(result).toEqual({
      '--shiki-dark': '#fff',
      backgroundColor: '#000',
    });
  });

  it('handles junk/empty segments without throwing', () => {
    const result = styleStringToObject(';; color: red; : ;');
    expect(result).toEqual({ color: 'red' });
  });

  it('trims whitespace correctly', () => {
    const result = styleStringToObject('  color :  red  ');
    expect(result).toEqual({ color: 'red' });
  });
});

describe('htmlToHastFragment', () => {
  it('returns no raw nodes', () => {
    // representative Shiki-ish HTML
    const html = `<pre class="shiki" style="background-color: #1e1e1e">
      <code><span style="color: #569cd6">const</span></code>
    </pre>`;

    const children = htmlToHastFragment(html);

    let rawCount = 0;
    for (const child of children) {
      visit(child as Node, (node: Node) => {
        if (node.type === 'raw') {
          rawCount++;
        }
      });
    }

    expect(rawCount).toBe(0);
  });

  it('preserves style properties as strings for rehype-stringify', () => {
    const html = `<pre style="background-color: #1e1e1e">
      <code><span style="color: #569cd6">test</span></code>
    </pre>`;

    const children = htmlToHastFragment(html);

    let stringStyleCount = 0;
    for (const child of children) {
      visit(child as Node, 'element', (node: Node) => {
        const el = node as { properties?: { style?: unknown } };
        if (typeof el.properties?.style === 'string') {
          stringStyleCount++;
        }
      });
    }

    // styles should remain as strings for HTML output
    // pre & span both have style attrs
    expect(stringStyleCount).toBe(2);
  });
});
