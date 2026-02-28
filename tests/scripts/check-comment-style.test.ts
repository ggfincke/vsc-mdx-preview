// tests/scripts/check-comment-style.test.ts
// unit tests for repo comment-style guardrail script

import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const scriptPath = path.resolve(process.cwd(), 'scripts/check-comment-style.mjs');

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'comment-style-check-'));
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

describe('check-comment-style', () => {
  it('passes when run in the actual project root', () => {
    const result = runCheck(process.cwd());

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Comment style check passed');
  });

  it('fails when the file header is missing', () => {
    const tempDir = createTempDir();
    try {
      writeFile(tempDir, 'packages/sample/src/file.ts', 'export const value = 1;\n');

      const result = runCheck(tempDir);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('[file-header-path]');
      expect(result.stderr).toContain('[file-header-description]');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails on inline comments', () => {
    const tempDir = createTempDir();
    try {
      writeFile(
        tempDir,
        'packages/sample/src/file.ts',
        "const value = 1; // inline comment\n"
      );

      const result = runCheck(tempDir);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('[inline-comment]');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails on block comments', () => {
    const tempDir = createTempDir();
    try {
      writeFile(
        tempDir,
        'packages/sample/src/file.ts',
        '/* block comment */\nexport const value = 1;\n'
      );

      const result = runCheck(tempDir);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('[block-comment]');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails on comments that use and/with instead of shorthand', () => {
    const tempDir = createTempDir();
    try {
      writeFile(
        tempDir,
        'packages/sample/src/file.ts',
        '// load and cache with fallback\nexport const value = 1;\n'
      );

      const result = runCheck(tempDir);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('[wording]');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails on trailing punctuation but allows path headers', () => {
    const tempDir = createTempDir();
    try {
      writeFile(
        tempDir,
        'packages/sample/src/file.ts',
        [
          '// packages/sample/src/file.ts',
          '// valid header',
          '// this comment ends in punctuation.',
          'export const value = 1;',
          '',
        ].join('\n')
      );

      const result = runCheck(tempDir);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('[punctuation]');
      expect(result.stderr).not.toContain('packages/sample/src/file.ts:1');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('ignores excluded dev-docs content', () => {
    const tempDir = createTempDir();
    try {
      writeFile(
        tempDir,
        'packages/sample/src/file.ts',
        [
          '// packages/sample/src/file.ts',
          '// valid header',
          'export const value = 1;',
          '',
        ].join('\n')
      );
      writeFile(
        tempDir,
        'dev-docs/example.ts',
        '/* block comment that should be ignored */\n'
      );

      const result = runCheck(tempDir);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Comment style check passed');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
