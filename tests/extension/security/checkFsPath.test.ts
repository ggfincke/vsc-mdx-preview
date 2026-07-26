// tests/extension/security/checkFsPath.test.ts
// verify representative filesystem path trust boundaries

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const mockWorkspaceFolders = vi.fn();

vi.mock('vscode', () => ({
  workspace: {
    get workspaceFolders() {
      return mockWorkspaceFolders();
    },
  },
}));

import {
  checkFsPathAsync,
  handleDidChangeWorkspaceFolders,
} from '../../../packages/extension-host/src/features/module-runtime/security/checkFsPath';
import { isPathWithin } from '../../../packages/extension-host/src/shared/utils/path-utils';

function createWorkspaceFolder(fsPath: string) {
  return {
    uri: { fsPath },
    name: path.basename(fsPath),
    index: 0,
  };
}

describe('checkFsPathAsync', () => {
  beforeEach(() => {
    handleDidChangeWorkspaceFolders();
    vi.clearAllMocks();
    mockWorkspaceFolders.mockReturnValue([createWorkspaceFolder('/workspace')]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('enforces active workspace boundaries', async () => {
    await expect(
      checkFsPathAsync('/workspace/src', '/workspace/src/file.ts')
    ).resolves.toBe(true);

    await expect(
      checkFsPathAsync('/workspace/src', '/other/file.ts')
    ).resolves.toBe(false);

    mockWorkspaceFolders.mockReturnValue([
      createWorkspaceFolder('/workspace'),
      createWorkspaceFolder('/workspace/site'),
    ]);

    await expect(
      checkFsPathAsync('/workspace/site/docs', '/workspace/site/src/file.ts')
    ).resolves.toBe(true);
    await expect(
      checkFsPathAsync('/workspace/site/docs', '/workspace/shared/file.ts')
    ).resolves.toBe(false);
  });

  it('blocks traversal that escapes the workspace while allowing normalized internal paths', async () => {
    await expect(
      checkFsPathAsync('/workspace/src', '/workspace/src/../config/secret.ts')
    ).resolves.toBe(true);
    await expect(
      checkFsPathAsync('/workspace/src', '/workspace/../etc/passwd')
    ).resolves.toBe(false);
  });

  it('rejects relative traversal attempts that escape the workspace root', async () => {
    await expect(
      checkFsPathAsync('/workspace/src', '../../../etc/passwd')
    ).resolves.toBe(false);

    expect(isPathWithin('/workspace/app/docs', '/workspace/app')).toBe(true);
    expect(isPathWithin('/workspace/app-two', '/workspace/app')).toBe(false);
    expect(isPathWithin('/workspace/app', '/workspace/app')).toBe(true);
    expect(isPathWithin('/workspace/app', '/workspace/app', false)).toBe(false);
  });

  it('refreshes a cached realpath after an ancestor symlink is repointed', async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'mdx-path-security-')
    );
    const workspaceRoot = path.join(tempDir, 'workspace');
    const entryDirectory = path.join(workspaceRoot, 'docs');
    const insidePackage = path.join(workspaceRoot, 'inside-package');
    const outsidePackage = path.join(tempDir, 'outside-package');
    const linkedPackage = path.join(workspaceRoot, 'linked-package');
    const linkedFile = path.join(linkedPackage, 'index.js');
    try {
      fs.mkdirSync(entryDirectory, { recursive: true });
      fs.mkdirSync(insidePackage, { recursive: true });
      fs.mkdirSync(outsidePackage, { recursive: true });
      fs.writeFileSync(path.join(insidePackage, 'index.js'), 'inside');
      fs.writeFileSync(path.join(outsidePackage, 'index.js'), 'outside');
      const linkType = process.platform === 'win32' ? 'junction' : 'dir';
      fs.symlinkSync(insidePackage, linkedPackage, linkType);
      mockWorkspaceFolders.mockReturnValue([
        createWorkspaceFolder(workspaceRoot),
      ]);

      await expect(checkFsPathAsync(entryDirectory, linkedFile)).resolves.toBe(
        true
      );

      fs.unlinkSync(linkedPackage);
      fs.symlinkSync(outsidePackage, linkedPackage, linkType);

      await expect(checkFsPathAsync(entryDirectory, linkedFile)).resolves.toBe(
        false
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
