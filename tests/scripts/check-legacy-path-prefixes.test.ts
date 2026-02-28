// tests/scripts/check-legacy-path-prefixes.test.ts
// check legacy path prefixes test coverage
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const scriptPath = path.resolve(
  process.cwd(),
  'scripts/check-legacy-path-prefixes.mjs'
);
const LEGACY_EXTENSION_PREFIX = ['packages', 'extension', ''].join('/');
const LEGACY_WEBVIEW_PREFIX = ['packages', 'webview-app', ''].join('/');

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-path-check-'));
}

function writeFile(
  rootDir: string,
  relativePath: string,
  contents: string
): void {
  const fullPath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, contents, 'utf-8');
}

function runCheck(cwd: string) {
  return spawnSync('node', [scriptPath], {
    encoding: 'utf8',
    cwd,
  });
}

describe('check-legacy-path-prefixes', () => {
  it('passes when run in the actual project root', () => {
    const result = runCheck(process.cwd());

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Legacy path prefix check passed');
  });

  it('fails when legacy extension prefix is present in scanned files', () => {
    const tempDir = createTempDir();
    try {
      writeFile(
        tempDir,
        'packages/sample/src/file.ts',
        `const x = '${LEGACY_EXTENSION_PREFIX}module-system/handlers';\n`
      );

      const result = runCheck(tempDir);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Legacy path prefix check FAILED');
      expect(result.stderr).toContain(LEGACY_EXTENSION_PREFIX);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails when legacy webview-app prefix is present in scanned files', () => {
    const tempDir = createTempDir();
    try {
      writeFile(
        tempDir,
        'docs/example.md',
        `Use ${LEGACY_WEBVIEW_PREFIX}src/hooks/usePreviewSetup.ts\n`
      );

      const result = runCheck(tempDir);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Legacy path prefix check FAILED');
      expect(result.stderr).toContain(LEGACY_WEBVIEW_PREFIX);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('ignores excluded dev-docs content', () => {
    const tempDir = createTempDir();
    try {
      writeFile(tempDir, 'docs/ok.md', 'No legacy paths here\n');
      writeFile(
        tempDir,
        'dev-docs/legacy.md',
        `This historical note references ${LEGACY_WEBVIEW_PREFIX}src/App.tsx\n`
      );

      const result = runCheck(tempDir);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Legacy path prefix check passed');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
