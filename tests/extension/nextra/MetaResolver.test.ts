// tests/extension/nextra/MetaResolver.test.ts
// unit tests for Nextra meta resolution

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MetaResolver, resolveNextraMeta, mergeNextraMeta } from '../../../packages/extension-host/src/features/framework/nextra/MetaResolver';

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  MetaResolver.reset();
});

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

describe('MetaResolver', () => {
  beforeEach(() => {
    MetaResolver.reset();
  });

  it('resolves string title entries', () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mdx-preview-nextra-'));
    tempDirs.push(workspaceRoot);

    const metaPath = path.join(workspaceRoot, '_meta.json');
    writeFile(
      metaPath,
      JSON.stringify({
        'getting-started': 'Getting Started',
      })
    );

    const mdxPath = path.join(workspaceRoot, 'getting-started.mdx');
    writeFile(mdxPath, '# Getting Started');

    const result = resolveNextraMeta(mdxPath, workspaceRoot);

    expect(result).toEqual({ title: 'Getting Started' });
  });

  it('resolves theme options from object entries', () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mdx-preview-nextra-'));
    tempDirs.push(workspaceRoot);

    const metaPath = path.join(workspaceRoot, '_meta.json');
    writeFile(
      metaPath,
      JSON.stringify({
        advanced: {
          title: 'Advanced',
          theme: { layout: 'full', toc: false },
        },
      })
    );

    const mdxPath = path.join(workspaceRoot, 'advanced.mdx');
    writeFile(mdxPath, '# Advanced');

    const result = resolveNextraMeta(mdxPath, workspaceRoot);

    expect(result).toEqual({ title: 'Advanced', layout: 'full', toc: false });
  });

  it('merges frontmatter over _meta.json values', () => {
    const meta = { title: 'Doc', layout: 'default', toc: true };
    const frontmatter = { layout: 'raw', toc: false };

    const merged = mergeNextraMeta(meta, frontmatter);

    expect(merged).toEqual({ title: 'Doc', layout: 'raw', toc: false });
  });

  it('invalidates cache when meta changes', () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mdx-preview-nextra-'));
    tempDirs.push(workspaceRoot);

    const metaPath = path.join(workspaceRoot, '_meta.json');
    const mdxPath = path.join(workspaceRoot, 'page.mdx');
    writeFile(mdxPath, '# Page');

    writeFile(metaPath, JSON.stringify({ page: 'Initial Title' }));

    const resolver = MetaResolver.getInstance();
    const first = resolver.resolveNextraMeta(mdxPath, workspaceRoot);

    expect(first).toEqual({ title: 'Initial Title' });

    writeFile(metaPath, JSON.stringify({ page: 'Updated Title' }));

    const cache = (resolver as any).metaCache as {
      invalidateByPrefix: (prefix: string) => void;
    };
    cache.invalidateByPrefix(`${path.dirname(mdxPath)}:`);

    const second = resolver.resolveNextraMeta(mdxPath, workspaceRoot);
    expect(second).toEqual({ title: 'Updated Title' });
  });
});
