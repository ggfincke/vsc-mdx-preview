// tests/extension/themes/IconPackResolver.test.ts
// verify icon pack resolution: trust gating, path containment & file limits

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

const mockWorkspaceFolders = vi.fn();
const mockIsTrusted = vi.fn();

vi.mock('vscode', () => ({
  workspace: {
    get workspaceFolders() {
      return mockWorkspaceFolders();
    },
    get isTrusted() {
      return mockIsTrusted();
    },
    getWorkspaceFolder(uri: { fsPath: string }) {
      const folders = (mockWorkspaceFolders() || []) as Array<{
        uri: { fsPath: string };
      }>;
      return folders.find(
        (folder) =>
          uri.fsPath === folder.uri.fsPath ||
          uri.fsPath.startsWith(folder.uri.fsPath + '/')
      );
    },
  },
}));

import { resolveMermaidIconPacks } from '../../../packages/extension-host/src/features/themes/IconPackResolver';

const SAMPLE = { icons: { box: { body: '<path d="M0 0h24v24H0z"/>' } } };

let wsDir: string;
let docUri: { fsPath: string };

function writePack(rel: string, json: unknown): void {
  const target = path.join(wsDir, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(json));
}

// the resolver expects a vscode.Uri; a bare fsPath bag is enough at runtime
function uri(fsPath: string): never {
  return { fsPath } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  wsDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'iconpack-')));
  docUri = { fsPath: path.join(wsDir, 'doc.mdx') };
  mockIsTrusted.mockReturnValue(true);
  mockWorkspaceFolders.mockReturnValue([{ uri: { fsPath: wsDir } }]);
});

afterEach(() => {
  vi.restoreAllMocks();
  try {
    fs.rmSync(wsDir, { recursive: true, force: true });
  } catch {
    // best effort temp cleanup
  }
});

describe('resolveMermaidIconPacks', () => {
  it('resolves a valid in-workspace relative pack', async () => {
    writePack('icons/pack.json', SAMPLE);
    const out = await resolveMermaidIconPacks(
      [{ name: 'aws', source: './icons/pack.json' }],
      uri(docUri.fsPath)
    );
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('aws');
    expect(Object.keys(out[0].icons.icons)).toEqual(['box']);
  });

  it('reads nothing in an untrusted workspace', async () => {
    writePack('icons/pack.json', SAMPLE);
    mockIsTrusted.mockReturnValue(false);
    const out = await resolveMermaidIconPacks(
      [{ name: 'aws', source: './icons/pack.json' }],
      uri(docUri.fsPath)
    );
    expect(out).toEqual([]);
  });

  it('rejects relative sources that escape the workspace', async () => {
    const out = await resolveMermaidIconPacks(
      [{ name: 'aws', source: '../../../../etc/hostname' }],
      uri(docUri.fsPath)
    );
    expect(out).toEqual([]);
  });

  it('skips the reserved name "logos" and invalid names', async () => {
    writePack('icons/pack.json', SAMPLE);
    const out = await resolveMermaidIconPacks(
      [
        { name: 'logos', source: './icons/pack.json' },
        { name: 'has space', source: './icons/pack.json' },
        { name: 'evil:prefix', source: './icons/pack.json' },
      ],
      uri(docUri.fsPath)
    );
    expect(out).toEqual([]);
  });

  it('skips non-regular files (e.g. a directory source)', async () => {
    fs.mkdirSync(path.join(wsDir, 'icons'), { recursive: true });
    const out = await resolveMermaidIconPacks(
      [{ name: 'dir', source: './icons' }],
      uri(docUri.fsPath)
    );
    expect(out).toEqual([]);
  });

  it('rejects malformed / non-Iconify JSON', async () => {
    writePack('bad.json', { not: 'a pack' });
    const out = await resolveMermaidIconPacks(
      [{ name: 'bad', source: './bad.json' }],
      uri(docUri.fsPath)
    );
    expect(out).toEqual([]);
  });

  it('drops a beacon icon but keeps the pack when other icons are safe', async () => {
    writePack('mix.json', {
      icons: {
        good: { body: '<path d="M0 0"/>' },
        bad: { body: '<image href="https://evil.example/x"/>' },
      },
    });
    const out = await resolveMermaidIconPacks(
      [{ name: 'mix', source: './mix.json' }],
      uri(docUri.fsPath)
    );
    expect(out).toHaveLength(1);
    expect(Object.keys(out[0].icons.icons)).toEqual(['good']);
  });

  it('deduplicates repeated pack names', async () => {
    writePack('icons/pack.json', SAMPLE);
    const out = await resolveMermaidIconPacks(
      [
        { name: 'aws', source: './icons/pack.json' },
        { name: 'aws', source: './icons/pack.json' },
      ],
      uri(docUri.fsPath)
    );
    expect(out).toHaveLength(1);
  });
});
