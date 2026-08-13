// tests/webview/build-provenance.test.ts
// regression coverage for fail-closed webview module provenance

import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  findForbiddenStaticModules,
  parseWebviewManifest,
  parseWebviewModuleProvenance,
  validateWebviewChunkProvenance,
  validateWebviewManifestHash,
} from '../../scripts/lib/webview-module-provenance.mjs';

describe('webview module provenance', () => {
  it('fails closed & detects forbidden modules under generic chunk names', () => {
    const emittedChunks = new Map<string, Buffer>([
      ['static/js/main.js', Buffer.from('import "./chunk-a.js";')],
      ['static/js/chunk-a.js', Buffer.from('export const value = 1;')],
      ['static/js/dynamic.js', Buffer.from('export const lazy = true;')],
    ]);
    const hash = (fileName: string) =>
      createHash('sha256').update(emittedChunks.get(fileName)!).digest('hex');
    const manifest = {
      'index.html': {
        file: 'static/js/main.js',
        isEntry: true,
        imports: ['_chunk-a.js'],
        dynamicImports: ['_dynamic.js'],
      },
      '_chunk-a.js': { file: 'static/js/chunk-a.js' },
      '_dynamic.js': {
        file: 'static/js/dynamic.js',
        isDynamicEntry: true,
      },
    };
    const manifestSource = Buffer.from(JSON.stringify(manifest));
    const provenance = {
      version: 2,
      manifestSha256: createHash('sha256').update(manifestSource).digest('hex'),
      chunks: {
        'static/js/main.js': {
          sha256: hash('static/js/main.js'),
          modules: [
            '/repo/src/features/diagrams/ui/LazyDiagramRenderers/LazyDiagramRenderers.tsx',
            '/repo/src/features/diagrams/ui/MermaidRenderer/MermaidRenderer.tsx',
          ],
        },
        'static/js/chunk-a.js': {
          sha256: hash('static/js/chunk-a.js'),
          modules: [
            'C:\\repo\\src\\features\\diagrams\\ui\\PlantUMLRenderer\\PlantUMLRenderer.tsx',
            '/repo/src/features/diagrams/ui/GraphvizRenderer/GraphvizRenderer.tsx',
            '/repo/node_modules/mermaid/dist/mermaid.core.mjs',
            '/repo/node_modules/@mermaid-js/parser/dist/index.mjs',
            '/repo/node_modules/@viz-js/viz/dist/viz.js',
          ],
        },
        'static/js/dynamic.js': {
          sha256: hash('static/js/dynamic.js'),
          modules: [
            '/repo/src/features/diagrams/ui/MermaidRenderer/dynamic.tsx',
          ],
        },
      },
    };
    const parsedProvenance = parseWebviewModuleProvenance(provenance);
    validateWebviewManifestHash(
      parsedProvenance.manifestSha256,
      manifestSource
    );
    const chunks = parsedProvenance.chunks;
    const manifestChunks = parseWebviewManifest(manifest);
    const { staticFiles } = validateWebviewChunkProvenance(
      chunks,
      manifestChunks,
      emittedChunks
    );

    const forbiddenModules = findForbiddenStaticModules(chunks, staticFiles);
    expect(forbiddenModules).toHaveLength(6);
    expect(forbiddenModules).toEqual(
      expect.arrayContaining([
        expect.stringContaining('MermaidRenderer/MermaidRenderer.tsx'),
        expect.stringContaining('PlantUMLRenderer\\PlantUMLRenderer.tsx'),
        expect.stringContaining('GraphvizRenderer/GraphvizRenderer.tsx'),
        expect.stringContaining('node_modules/mermaid/'),
        expect.stringContaining('node_modules/@mermaid-js/'),
        expect.stringContaining('node_modules/@viz-js/viz/'),
      ])
    );
    expect(forbiddenModules.join('\n')).not.toContain('LazyDiagramRenderers');
    expect(forbiddenModules.join('\n')).not.toContain('dynamic.tsx');

    const changedBytes = new Map(emittedChunks);
    changedBytes.set('static/js/main.js', Buffer.from('same name, new bytes'));
    expect(() =>
      validateWebviewChunkProvenance(chunks, manifestChunks, changedBytes)
    ).toThrow('hash mismatch for static/js/main.js');

    const swappedProvenance = structuredClone(provenance);
    [
      swappedProvenance.chunks['static/js/main.js'],
      swappedProvenance.chunks['static/js/chunk-a.js'],
    ] = [
      swappedProvenance.chunks['static/js/chunk-a.js'],
      swappedProvenance.chunks['static/js/main.js'],
    ];
    expect(() =>
      validateWebviewChunkProvenance(
        parseWebviewModuleProvenance(swappedProvenance).chunks,
        manifestChunks,
        emittedChunks
      )
    ).toThrow('hash mismatch');

    const staleTopology = structuredClone(manifest);
    staleTopology['index.html'].imports = [];
    expect(() =>
      validateWebviewManifestHash(
        parsedProvenance.manifestSha256,
        Buffer.from(JSON.stringify(staleTopology))
      )
    ).toThrow('manifest hash mismatch');

    const staleManifest = {
      ...structuredClone(manifest),
      '_new.js': { file: 'static/js/new.js' },
    };
    const newerEmittedChunks = new Map(emittedChunks);
    newerEmittedChunks.set(
      'static/js/new.js',
      Buffer.from('export const newChunk = true;')
    );
    expect(() =>
      validateWebviewChunkProvenance(
        chunks,
        parseWebviewManifest(staleManifest),
        newerEmittedChunks
      )
    ).toThrow('missing from provenance: static/js/new.js');

    const missingChunk = new Map(emittedChunks);
    missingChunk.delete('static/js/chunk-a.js');
    expect(() =>
      validateWebviewChunkProvenance(chunks, manifestChunks, missingChunk)
    ).toThrow('chunk filenames differ');

    expect(() =>
      parseWebviewModuleProvenance({ version: 1, chunks: {} })
    ).toThrow('version 2 chunk records');
    expect(() =>
      parseWebviewModuleProvenance({
        version: 2,
        manifestSha256: provenance.manifestSha256,
        chunks: {
          'static/js/main.js': {
            sha256: 'stale',
            modules: ['/repo/main.ts'],
          },
        },
      })
    ).toThrow('invalid chunk record for static/js/main.js');
  });
});
