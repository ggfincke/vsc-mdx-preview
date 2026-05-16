// tests/webview/SafePreview.test.ts
// verify representative safe-mode sanitization boundaries
// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import DOMPurify from 'dompurify';
import { DOMPURIFY_CONFIG } from '../../packages/webview-client/src/features/preview/safe/security/allowlist';

describe('SafePreview sanitization', () => {
  it('strips script tags', () => {
    const result = DOMPurify.sanitize(
      '<div><script>alert("xss")</script>safe</div>',
      DOMPURIFY_CONFIG
    );

    expect(result).not.toContain('<script');
    expect(result).toContain('safe');
  });

  it('strips event handler attributes', () => {
    const result = DOMPurify.sanitize(
      '<img src=x onerror="alert(1)"><div onclick="malicious()">x</div>',
      DOMPURIFY_CONFIG
    );

    expect(result).not.toMatch(/on\w+=/);
  });

  it('strips script and foreignObject content from SVG payloads', () => {
    const result = DOMPurify.sanitize(
      '<svg><script>alert(1)</script><foreignObject><div onclick="xss()">test</div></foreignObject></svg>',
      DOMPURIFY_CONFIG
    );

    expect(result).not.toContain('<script');
    expect(result).not.toContain('foreignObject');
    expect(result).not.toContain('onclick');
  });

  it('strips dangerous protocols from links', () => {
    const result = DOMPurify.sanitize(
      '<a href="javascript:alert(1)">click</a><a href="data:text/html,test">x</a>',
      DOMPURIFY_CONFIG
    );

    expect(result).not.toMatch(/javascript:|data:/);
  });

  it('strips form and iframe embedding vectors', () => {
    const result = DOMPurify.sanitize(
      '<form action="https://evil.com"><input name="pw"></form><iframe src="https://evil.com"></iframe>',
      DOMPURIFY_CONFIG
    );

    expect(result).not.toMatch(/<(form|iframe|input)/);
  });

  it('preserves standard markdown-rendered HTML', () => {
    const result = DOMPurify.sanitize(
      '<h1>Title</h1><p>Text w/ <strong>bold</strong> & <em>italic</em></p>',
      DOMPURIFY_CONFIG
    );

    expect(result).toContain('<h1>');
    expect(result).toContain('<strong>');
    expect(result).toContain('<em>');
  });
});
