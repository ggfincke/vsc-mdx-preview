// packages/extension/test/transpiler.integration.test.ts
// integration tests for MDX transpiler (layout injection, frontmatter extraction)

import { describe, test, expect } from 'vitest';
import * as vscode from 'vscode';
import { InMemoryDocument } from './InMemoryDocument';
import { Preview } from '../preview/preview-manager';

import * as mdx from '../transpiler/mdx/mdx';

// helper updated to accept code string from TrustedCompileResult
const expectModernWrapper = (code: string): void => {
  expect(code).toContain("import React from 'react'");
  expect(code).toContain('export default MDXContent');
  expect(code).not.toContain('ReactDOM');
  expect(code).not.toContain('@mdx-js/tag');
};

describe('Transpiler Tests', function () {
  test('Transpiles entry mdx file (no default export)', async function () {
    const content = 'hello';
    const mockDoc = new InMemoryDocument(vscode.Uri.file('test.md'), content);
    const mockPreview = new Preview(mockDoc);
    const mdxText = mockPreview.text;
    const isEntry = true;
    // mdxTranspileAsync now returns { code, frontmatter }
    const result = await mdx.mdxTranspileAsync(mdxText, isEntry, mockPreview);
    expectModernWrapper(result.code);
    expect(result.code).toContain(
      "import { createLayout } from 'vscode-markdown-layout';"
    );
  });

  // w/ white background config adds the necessary params to layout
  test('Transpiles entry mdx file w/ vscode markdown styles & white background config (no default export)', async function () {
    const content = 'hello';
    const mockDoc = new InMemoryDocument(vscode.Uri.file('test.md'), content);
    const mockPreview = new Preview(mockDoc);
    mockPreview.configuration.useVscodeMarkdownStyles = true;
    mockPreview.configuration.useWhiteBackground = true;
    const mdxText = mockPreview.text;
    const isEntry = true;
    const result = await mdx.mdxTranspileAsync(mdxText, isEntry, mockPreview);
    expectModernWrapper(result.code);
    expect(result.code).toContain(
      "import { createLayout } from 'vscode-markdown-layout';"
    );
    expect(result.code).toContain('createLayout({ forceLightTheme: true })');
  });

  test('Transpiles entry mdx file w/ no vscode markdown styles (no default export)', async function () {
    const content = 'hello';
    const mockDoc = new InMemoryDocument(vscode.Uri.file('test.md'), content);
    const mockPreview = new Preview(mockDoc);
    mockPreview.configuration.useVscodeMarkdownStyles = false;
    const mdxText = mockPreview.text;
    const isEntry = true;
    const result = await mdx.mdxTranspileAsync(mdxText, isEntry, mockPreview);
    expectModernWrapper(result.code);
    expect(result.code).not.toContain('vscode-markdown-layout');
  });

  // custom layout file takes precedence over vscode markdown styles
  test('Transpiles entry mdx file w/ custom layout file (no default export)', async function () {
    const content = 'hello';
    const mockDoc = new InMemoryDocument(vscode.Uri.file('test.md'), content);
    const mockPreview = new Preview(mockDoc);
    mockPreview.configuration.customLayoutFilePath = '/mdx/customLayout.js';
    mockPreview.configuration.useVscodeMarkdownStyles = true;
    const mdxText = mockPreview.text;
    const isEntry = true;
    const result = await mdx.mdxTranspileAsync(mdxText, isEntry, mockPreview);
    expectModernWrapper(result.code);
    expect(result.code).toContain('import Layout from');
    expect(result.code).toContain('customLayout.js');
  });

  // non entry file don't append render code to the DOM
  test('Transpiles non-entry mdx file (no default export)', async function () {
    const content = 'hello';
    const mockDoc = new InMemoryDocument(vscode.Uri.file('test.md'), content);
    const mockPreview = new Preview(mockDoc);
    const mdxText = mockPreview.text;
    const isEntry = false;
    const result = await mdx.mdxTranspileAsync(mdxText, isEntry, mockPreview);
    expectModernWrapper(result.code);
  });

  // default export takes precedence over custom layout file or vscode markdown styles
  test('Transpiles entry mdx file (w/ default export)', async function () {
    const content = `import Layout from './layout';\n\nexport default Layout;\n\nhello`;
    const mockDoc = new InMemoryDocument(vscode.Uri.file('test.md'), content);
    const mockPreview = new Preview(mockDoc);
    mockPreview.configuration.customLayoutFilePath = '/mdx/customLayout.js';
    mockPreview.configuration.useVscodeMarkdownStyles = true;
    const mdxText = mockPreview.text;
    const isEntry = true;
    const result = await mdx.mdxTranspileAsync(mdxText, isEntry, mockPreview);
    expectModernWrapper(result.code);
    expect(result.code).not.toContain('vscode-markdown-layout');
    expect(result.code).not.toContain('customLayout.js');
  });

  // test frontmatter extraction
  test('Extracts frontmatter from MDX file', async function () {
    const content = `---
title: Test Document
author: Test Author
tags:
  - mdx
  - test
---

# Hello World`;
    const mockDoc = new InMemoryDocument(vscode.Uri.file('test.mdx'), content);
    const mockPreview = new Preview(mockDoc);
    const mdxText = mockPreview.text;
    const isEntry = true;
    const result = await mdx.mdxTranspileAsync(mdxText, isEntry, mockPreview);
    expect(result.frontmatter).toBeDefined();
    expect(result.frontmatter.title).toBe('Test Document');
    expect(result.frontmatter.author).toBe('Test Author');
    expect(result.frontmatter.tags).toEqual(['mdx', 'test']);
  });
});
