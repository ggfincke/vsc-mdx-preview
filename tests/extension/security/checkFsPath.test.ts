// tests/extension/security/checkFsPath.test.ts
// verify representative filesystem path trust boundaries

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('allows files that stay inside the active workspace', async () => {
    await expect(
      checkFsPathAsync('/workspace/src', '/workspace/src/file.ts')
    ).resolves.toBe(true);
  });

  it('rejects files outside the active workspace', async () => {
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
});
