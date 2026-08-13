// tests/webview/linkHandler.test.ts
// representative link classification & host URL normalization

import { describe, expect, it } from 'vitest';
import {
  classifyLink,
  getRelativeFilePath,
  normalizeExternalHref,
  type LinkType,
} from '../../packages/webview-client/src/shared/utils/linkHandler';

describe('linkHandler', () => {
  it('classifies representative destinations & normalizes external URLs', () => {
    const cases: Array<[string, LinkType]> = [
      ['https://example.com/docs', 'external'],
      ['http://example.com/docs', 'external'],
      ['HTTPS://example.com/docs', 'external'],
      ['https://example.com/a b?q=x y', 'external'],
      ['https://example.com/path?q=\\value', 'external'],
      ['HTTPS:example.com/docs', 'unknown'],
      ['https:/example.com/docs', 'unknown'],
      ['https:\\example.com/docs', 'unknown'],
      ['http:////example.com/docs', 'unknown'],
      ['https://example.com\\@evil.test/path', 'unknown'],
      ['https://example.com/path\\child', 'unknown'],
      ['//cdn.example.com/file', 'external'],
      ['//cdn.example.com/a b?q=x y', 'external'],
      ['//cdn.example.com/path?q=\\value', 'external'],
      ['//example.com\\path', 'unknown'],
      ['///path', 'unknown'],
      ['////path', 'unknown'],
      ['//\t/path', 'unknown'],
      ['//\t\\host/path', 'unknown'],
      ['https://example.com/a\u001fb', 'unknown'],
      ['https://example.com/a\u007fb', 'unknown'],
      ['/workspace/docs/page', 'relative-file'],
      ['./guide.mdx?mode=full#intro', 'relative-file'],
      ['./guide%20one.mdx?mode=full#intro', 'relative-file'],
      ['./guide%2Fone.mdx', 'unknown'],
      ['./guide%ZZ.mdx', 'unknown'],
      ['C:\\workspace\\guide.md', 'relative-file'],
      ['\\\\server\\share\\diagram.svg', 'relative-file'],
      ['\\workspace\\diagram.svg', 'relative-file'],
      ['file:///workspace/guide.mdx', 'relative-file'],
      ['file:///workspace/a%2Fb.mdx', 'unknown'],
      ['file:///workspace/a%5Cb.mdx', 'unknown'],
      ['file:///workspace/a%00b.mdx', 'unknown'],
      ['#intro', 'anchor'],
      ['mailto:docs@example.com', 'external'],
      ['mailto:docs team@example.com?subject=hello world', 'external'],
      ['tel:+1 212 555 0100', 'external'],
      ['not a link', 'unknown'],
      ['//', 'unknown'],
      ['http://%', 'unknown'],
    ];

    expect(cases.map(([href]) => classifyLink(href))).toEqual(
      cases.map(([, expected]) => expected)
    );
    expect(normalizeExternalHref('//cdn.example.com/file')).toBe(
      'https://cdn.example.com/file'
    );
    expect(normalizeExternalHref('///path')).toBeUndefined();
    expect(normalizeExternalHref('//\t/path')).toBeUndefined();
    expect(normalizeExternalHref('HTTPS://example.com/docs')).toBe(
      'https://example.com/docs'
    );
    expect(normalizeExternalHref('HTTPS:example.com/docs')).toBeUndefined();
    expect(normalizeExternalHref('https://example.com/a b?q=x y')).toBe(
      'https://example.com/a%20b?q=x%20y'
    );
    expect(normalizeExternalHref('//cdn.example.com/a b?q=x y')).toBe(
      'https://cdn.example.com/a%20b?q=x%20y'
    );
    expect(
      normalizeExternalHref('mailto:docs team@example.com?subject=hello world')
    ).toBe('mailto:docs%20team@example.com?subject=hello%20world');
    expect(normalizeExternalHref('tel:+1 212 555 0100')).toBe(
      'tel:+1%20212%20555%200100'
    );
    expect(getRelativeFilePath('file:///workspace/guide%20one.mdx?q=1#x')).toBe(
      '/workspace/guide one.mdx'
    );
    expect(getRelativeFilePath('./guide%20one.mdx?q=1#x')).toBe(
      './guide one.mdx'
    );
    expect(getRelativeFilePath('file:///C:/workspace/guide.mdx')).toBe(
      'C:/workspace/guide.mdx'
    );
    expect(getRelativeFilePath('file://server/share/guide.mdx')).toBe(
      '//server/share/guide.mdx'
    );
    expect(getRelativeFilePath('file:///workspace/a%2Fb.mdx')).toBeUndefined();
    expect(getRelativeFilePath('file:///workspace/a%00b.mdx')).toBeUndefined();
  });
});
