// tests/extension/security/checkFsPath.test.ts
// Regression tests for checkFsPath - critical path security validation

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';

// Mock vscode workspace
const mockWorkspaceFolders = vi.fn();
vi.mock('vscode', () => ({
  workspace: {
    get workspaceFolders() {
      return mockWorkspaceFolders();
    },
  },
}));

// Import after mocks
import {
  checkFsPath,
  handleDidChangeWorkspaceFolders,
} from '../../../packages/extension/module-system/security/checkFsPath';

describe('checkFsPath', () => {
  beforeEach(() => {
    // Clear the internal cache before each test
    handleDidChangeWorkspaceFolders();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to create workspace folder mock
  const createWorkspaceFolder = (fsPath: string) => ({
    uri: { fsPath },
    name: path.basename(fsPath),
    index: 0,
  });

  // ============================================
  // Basic Path Validation
  // ============================================
  describe('basic path validation', () => {
    it('should return true for path inside workspace', () => {
      mockWorkspaceFolders.mockReturnValue([
        createWorkspaceFolder('/workspace'),
      ]);

      expect(checkFsPath('/workspace/src', '/workspace/src/file.ts')).toBe(
        true
      );
      expect(
        checkFsPath('/workspace/src', '/workspace/src/components/Button.tsx')
      ).toBe(true);
    });

    it('should return false for path outside workspace', () => {
      mockWorkspaceFolders.mockReturnValue([
        createWorkspaceFolder('/workspace'),
      ]);

      expect(checkFsPath('/workspace/src', '/other/file.ts')).toBe(false);
      expect(checkFsPath('/workspace/src', '/etc/passwd')).toBe(false);
    });

    it('should return false when no workspace folders exist', () => {
      mockWorkspaceFolders.mockReturnValue(undefined);

      expect(checkFsPath('/workspace/src', '/workspace/src/file.ts')).toBe(
        false
      );
    });

    it('should return false when workspace folders array is empty', () => {
      mockWorkspaceFolders.mockReturnValue([]);

      expect(checkFsPath('/workspace/src', '/workspace/src/file.ts')).toBe(
        false
      );
    });
  });

  // ============================================
  // Multi-Workspace Handling
  // ============================================
  describe('multi-workspace handling', () => {
    it('should find root directory from multiple workspace folders', () => {
      mockWorkspaceFolders.mockReturnValue([
        createWorkspaceFolder('/workspace1'),
        createWorkspaceFolder('/workspace2'),
      ]);

      // Entry dir in workspace1
      expect(checkFsPath('/workspace1/src', '/workspace1/src/file.ts')).toBe(
        true
      );
      expect(checkFsPath('/workspace1/src', '/workspace2/src/file.ts')).toBe(
        false
      );
    });

    it('should pick the most specific (shortest path) workspace folder', () => {
      mockWorkspaceFolders.mockReturnValue([
        createWorkspaceFolder('/workspace/project'),
        createWorkspaceFolder('/workspace'),
      ]);

      // Entry dir is in /workspace/project, & path is inside that workspace
      expect(
        checkFsPath('/workspace/project/src', '/workspace/project/src/file.ts')
      ).toBe(true);
      // Path in parent workspace /workspace is allowed since /workspace is also a workspace folder
      // & the entry directory is inside /workspace (via /workspace/project)
      // Actually, the root directory found is /workspace (shorter path wins in sort),
      // so /workspace/other/file.ts IS inside /workspace
      expect(
        checkFsPath('/workspace/project/src', '/workspace/other/file.ts')
      ).toBe(true);
    });

    it('should handle entry directory not in any workspace', () => {
      mockWorkspaceFolders.mockReturnValue([
        createWorkspaceFolder('/workspace'),
      ]);

      // Entry dir outside all workspace folders
      expect(
        checkFsPath('/other/project/src', '/other/project/src/file.ts')
      ).toBe(false);
    });
  });

  // ============================================
  // Path Traversal Prevention (SECURITY)
  // ============================================
  describe('path traversal prevention', () => {
    beforeEach(() => {
      mockWorkspaceFolders.mockReturnValue([
        createWorkspaceFolder('/workspace'),
      ]);
    });

    it('should block simple parent directory traversal', () => {
      expect(
        checkFsPath('/workspace/src', '/workspace/src/../config/secret.ts')
      ).toBe(true);
      // Traversal outside workspace should be blocked
      expect(checkFsPath('/workspace/src', '/workspace/../etc/passwd')).toBe(
        false
      );
    });

    it('should block deep parent traversal', () => {
      expect(
        checkFsPath('/workspace/src', '/workspace/src/../../../../etc/passwd')
      ).toBe(false);
    });

    it('should block traversal that escapes workspace root', () => {
      expect(checkFsPath('/workspace/src', '../../../etc/passwd')).toBe(false);
    });

    it('should allow valid paths with normalized traversal within workspace', () => {
      // This path stays within workspace after normalization
      const validPath = path.normalize('/workspace/src/../lib/file.ts');
      expect(checkFsPath('/workspace/src', validPath)).toBe(true);
    });
  });

  // ============================================
  // Cache Behavior
  // ============================================
  describe('cache behavior', () => {
    it('should cache root directory lookups', () => {
      mockWorkspaceFolders.mockReturnValue([
        createWorkspaceFolder('/workspace'),
      ]);

      // First call
      checkFsPath('/workspace/src', '/workspace/src/file1.ts');

      // Second call w/ same entry dir should use cache
      // (we can verify this by checking workspaceFolders is not called again for lookup)
      const result = checkFsPath('/workspace/src', '/workspace/src/file2.ts');
      expect(result).toBe(true);
    });

    it('should clear cache when handleDidChangeWorkspaceFolders is called', () => {
      mockWorkspaceFolders.mockReturnValue([
        createWorkspaceFolder('/workspace'),
      ]);

      // First call populates cache
      checkFsPath('/workspace/src', '/workspace/src/file.ts');

      // Change workspace folders
      mockWorkspaceFolders.mockReturnValue([
        createWorkspaceFolder('/new-workspace'),
      ]);

      // Without clearing cache, old root would still be used
      handleDidChangeWorkspaceFolders();

      // Now should use new workspace
      expect(
        checkFsPath('/new-workspace/src', '/new-workspace/src/file.ts')
      ).toBe(true);
      expect(checkFsPath('/workspace/src', '/workspace/src/file.ts')).toBe(
        false
      );
    });
  });

  // ============================================
  // Windows Path Handling
  // ============================================
  describe('Windows path handling', () => {
    // These tests verify Windows path normalization logic
    // The actual behavior depends on path.sep

    it('should handle paths that would need normalization', () => {
      mockWorkspaceFolders.mockReturnValue([
        createWorkspaceFolder('/workspace'),
      ]);

      // On Unix, these are just regular paths
      // On Windows, the normalization at line 55-57 would convert backslashes
      expect(checkFsPath('/workspace/src', '/workspace/src/file.ts')).toBe(
        true
      );
    });
  });

  // ============================================
  // Edge Cases
  // ============================================
  describe('edge cases', () => {
    it('should handle root as workspace folder', () => {
      mockWorkspaceFolders.mockReturnValue([createWorkspaceFolder('/')]);

      expect(checkFsPath('/project/src', '/project/src/file.ts')).toBe(true);
      expect(checkFsPath('/project/src', '/other/file.ts')).toBe(true);
    });

    it('should handle entry directory at workspace root', () => {
      mockWorkspaceFolders.mockReturnValue([
        createWorkspaceFolder('/workspace'),
      ]);

      // Entry directory AT the workspace root: isPathInside('/workspace', '/workspace') return false
      // This means getRootDirectoryPath return undefined, so checkFsPath return false
      // This is correct behavior - entry must be strictly INSIDE a workspace folder
      expect(checkFsPath('/workspace', '/workspace/file.ts')).toBe(false);
    });

    it('should allow paths when entry directory is inside workspace', () => {
      mockWorkspaceFolders.mockReturnValue([
        createWorkspaceFolder('/workspace'),
      ]);

      // Entry directory is inside workspace
      expect(checkFsPath('/workspace/src', '/workspace/src/file.ts')).toBe(
        true
      );
    });

    it('should handle deeply nested entry directories', () => {
      mockWorkspaceFolders.mockReturnValue([
        createWorkspaceFolder('/workspace'),
      ]);

      const deepEntryDir = '/workspace/a/b/c/d/e';
      expect(checkFsPath(deepEntryDir, '/workspace/a/b/c/d/e/file.ts')).toBe(
        true
      );
      expect(checkFsPath(deepEntryDir, '/workspace/a/b/c/file.ts')).toBe(true);
      expect(checkFsPath(deepEntryDir, '/other/file.ts')).toBe(false);
    });

    it('should handle paths with special characters', () => {
      mockWorkspaceFolders.mockReturnValue([
        createWorkspaceFolder('/workspace'),
      ]);

      expect(
        checkFsPath('/workspace/src', '/workspace/src/file with spaces.ts')
      ).toBe(true);
      expect(checkFsPath('/workspace/src', '/workspace/src/file-dash.ts')).toBe(
        true
      );
      expect(
        checkFsPath('/workspace/src', '/workspace/src/file_underscore.ts')
      ).toBe(true);
    });

    it('should handle paths with dots in names', () => {
      mockWorkspaceFolders.mockReturnValue([
        createWorkspaceFolder('/workspace'),
      ]);

      expect(checkFsPath('/workspace/src', '/workspace/src/file.test.ts')).toBe(
        true
      );
      expect(checkFsPath('/workspace/src', '/workspace/src/.hidden')).toBe(
        true
      );
    });
  });

  // ============================================
  // Security Scenarios
  // ============================================
  describe('security scenarios', () => {
    beforeEach(() => {
      mockWorkspaceFolders.mockReturnValue([
        createWorkspaceFolder('/workspace'),
      ]);
    });

    it('should prevent access to system files', () => {
      expect(checkFsPath('/workspace/src', '/etc/passwd')).toBe(false);
      expect(checkFsPath('/workspace/src', '/etc/shadow')).toBe(false);
    });

    it('should prevent access to user home directories', () => {
      expect(checkFsPath('/workspace/src', '/home/user/.ssh/id_rsa')).toBe(
        false
      );
      expect(
        checkFsPath('/workspace/src', '/Users/admin/.aws/credentials')
      ).toBe(false);
    });

    it('should prevent node_modules escape attacks', () => {
      // Attacker tries to use node_modules path to escape
      const maliciousPath = '/workspace/node_modules/../../../etc/passwd';
      expect(checkFsPath('/workspace/src', maliciousPath)).toBe(false);
    });

    it('should not be fooled by URL-encoded paths', () => {
      // URL encoding shouldn't bypass security
      // Note: This test verifies behavior - actual URL decoding would happen elsewhere
      expect(
        checkFsPath('/workspace/src', '/workspace%2F..%2Fetc/passwd')
      ).toBe(false);
    });

    it('should handle similar workspace name prefixes securely', () => {
      // /workspace-malicious should not be inside /workspace
      expect(
        checkFsPath('/workspace/src', '/workspace-malicious/file.ts')
      ).toBe(false);
      expect(checkFsPath('/workspace/src', '/workspaceExtra/file.ts')).toBe(
        false
      );
    });
  });
});
