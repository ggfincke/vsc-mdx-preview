// packages/extension/test/security.test.ts
// unit tests for filesystem path validation & security checks

import { describe, test, expect, beforeEach } from 'vitest';
import { __setMockWorkspaceFolders, __resetMocks } from './__mocks__/vscode';
import {
  checkFsPath,
  handleDidChangeWorkspaceFolders,
} from '../security/checkFsPath';

describe('checkFsPath', () => {
  beforeEach(() => {
    __resetMocks();
    // clear cache
    handleDidChangeWorkspaceFolders();
  });

  describe('workspace boundary enforcement', () => {
    beforeEach(() => {
      __setMockWorkspaceFolders([{ uri: { fsPath: '/projects/a' } }]);
    });

    test('returns false when accessing module outside of workspace folder', () => {
      // Entry directory is inside workspace /projects/a
      expect(
        checkFsPath('/projects/a/src', '/projects/b/node_modules/lodash')
      ).toBe(false);
      expect(
        checkFsPath('/projects/a/nested', '/projects/b/node_modules/lodash')
      ).toBe(false);
      expect(checkFsPath('/projects/a/src', '/node_modules/lodash')).toBe(
        false
      );
    });

    test('returns true when accessing module inside workspace folder', () => {
      // Entry directory is inside workspace /projects/a
      expect(
        checkFsPath('/projects/a/src', '/projects/a/node_modules/lodash')
      ).toBe(true);
      expect(
        checkFsPath('/projects/a/nested', '/projects/a/node_modules/lodash')
      ).toBe(true);
    });

    test('returns true for files directly in workspace', () => {
      // Entry directory must be inside workspace, not equal to it
      expect(checkFsPath('/projects/a/src', '/projects/a/src/index.ts')).toBe(
        true
      );
      expect(checkFsPath('/projects/a/docs', '/projects/a/package.json')).toBe(
        true
      );
    });
  });

  describe('path traversal prevention', () => {
    beforeEach(() => {
      __setMockWorkspaceFolders([{ uri: { fsPath: '/projects/a' } }]);
    });

    test('blocks path traversal attempts with ../', () => {
      // Attempting to escape workspace via ../
      expect(checkFsPath('/projects/a/src', '/projects/a/../b/secret.js')).toBe(
        false
      );
      expect(
        checkFsPath('/projects/a/src', '/projects/a/../../etc/passwd')
      ).toBe(false);
    });

    test('blocks deeply nested path traversal', () => {
      expect(
        checkFsPath(
          '/projects/a/src',
          '/projects/a/node_modules/../../../etc/passwd'
        )
      ).toBe(false);
    });

    test('allows legitimate relative paths within workspace', () => {
      // These resolve to paths still inside workspace
      expect(
        checkFsPath('/projects/a/src', '/projects/a/src/../lib/util.js')
      ).toBe(true);
    });
  });

  describe('absolute path validation', () => {
    beforeEach(() => {
      __setMockWorkspaceFolders([{ uri: { fsPath: '/projects/a' } }]);
    });

    test('blocks absolute paths outside workspace', () => {
      expect(checkFsPath('/projects/a/src', '/etc/passwd')).toBe(false);
      expect(checkFsPath('/projects/a/src', '/usr/local/bin/node')).toBe(false);
      expect(checkFsPath('/projects/a/src', '/home/user/.ssh/id_rsa')).toBe(
        false
      );
    });

    test('blocks root-level node_modules', () => {
      expect(checkFsPath('/projects/a/src', '/node_modules/malicious')).toBe(
        false
      );
    });
  });

  describe('edge cases', () => {
    test('handles paths with trailing slashes', () => {
      __setMockWorkspaceFolders([{ uri: { fsPath: '/projects/a/' } }]);
      handleDidChangeWorkspaceFolders();
      expect(checkFsPath('/projects/a/src', '/projects/a/file.js')).toBe(true);
    });

    test('blocks sibling workspace access', () => {
      __setMockWorkspaceFolders([{ uri: { fsPath: '/projects/workspace-a' } }]);
      handleDidChangeWorkspaceFolders();
      // Workspace A should not access files from sibling directories
      expect(
        checkFsPath(
          '/projects/workspace-a/src',
          '/projects/workspace-b/file.js'
        )
      ).toBe(false);
    });

    test('handles deeply nested workspace folders', () => {
      __setMockWorkspaceFolders([
        { uri: { fsPath: '/home/user/code/company/team/project' } },
      ]);
      handleDidChangeWorkspaceFolders();
      expect(
        checkFsPath(
          '/home/user/code/company/team/project/src',
          '/home/user/code/company/team/project/src/index.ts'
        )
      ).toBe(true);
      expect(
        checkFsPath(
          '/home/user/code/company/team/project/src',
          '/home/user/code/company/other-team/project/src/index.ts'
        )
      ).toBe(false);
    });

    test('returns false when entry directory is not inside any workspace', () => {
      __setMockWorkspaceFolders([{ uri: { fsPath: '/projects/a' } }]);
      handleDidChangeWorkspaceFolders();
      // Entry from outside workspace cannot access anything
      expect(checkFsPath('/projects/b/src', '/projects/b/file.js')).toBe(false);
    });
  });

  describe('no workspace folders', () => {
    test('returns false when no workspace folders are configured', () => {
      __setMockWorkspaceFolders([]);
      handleDidChangeWorkspaceFolders();
      expect(checkFsPath('/projects/a/src', '/projects/a/file.js')).toBe(false);
    });
  });

  describe('multiple workspace folders', () => {
    test('allows access to files in the containing workspace folder', () => {
      __setMockWorkspaceFolders([
        { uri: { fsPath: '/projects/a' } },
        { uri: { fsPath: '/projects/b' } },
      ]);
      handleDidChangeWorkspaceFolders();

      // Entry in workspace A can access files in workspace A
      expect(checkFsPath('/projects/a/src', '/projects/a/file.js')).toBe(true);

      // Entry in workspace B can access files in workspace B
      expect(checkFsPath('/projects/b/src', '/projects/b/file.js')).toBe(true);

      // Entry in workspace A cannot access files in workspace B
      expect(checkFsPath('/projects/a/src', '/projects/b/file.js')).toBe(false);
    });
  });

  describe('case sensitivity', () => {
    test('handles exact path matching', () => {
      __setMockWorkspaceFolders([{ uri: { fsPath: '/Projects/A' } }]);
      handleDidChangeWorkspaceFolders();
      expect(checkFsPath('/Projects/A/src', '/Projects/A/file.js')).toBe(true);
    });
  });
});
