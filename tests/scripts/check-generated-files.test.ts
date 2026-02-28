// tests/scripts/check-generated-files.test.ts
// check generated files test coverage
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const scriptPath = path.resolve(
  process.cwd(),
  'scripts/check-generated-files.mjs'
);

const HEADER = '// AUTO-GENERATED FILE - DO NOT EDIT\n// Source: test\n';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gen-check-'));
}

function writeGeneratedFile(rootDir: string, relativePath: string): void {
  const fullPath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, HEADER + 'export const x = 1;\n', 'utf-8');
}

function writeNonGeneratedFile(rootDir: string, relativePath: string): void {
  const fullPath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, '// regular file\nexport const x = 1;\n', 'utf-8');
}

function runCheck(cwd: string) {
  return spawnSync('node', [scriptPath], {
    encoding: 'utf8',
    cwd,
  });
}

describe('check-generated-files', () => {
  it('passes when run in the actual project root', () => {
    const result = spawnSync('node', [scriptPath], {
      encoding: 'utf8',
      cwd: process.cwd(),
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      'generated file(s) are in allowed locations'
    );
    expect(result.stdout).toContain('8 expected');
  });

  it('fails when a generated file is found in an unexpected location', () => {
    const tempDir = createTempDir();
    try {
      // create expected files in correct location
      writeGeneratedFile(
        tempDir,
        'packages/webview-client/src/generated/preload/preload.generated.ts'
      );
      writeGeneratedFile(
        tempDir,
        'packages/webview-client/src/generated/preload/aliases.generated.ts'
      );
      writeGeneratedFile(
        tempDir,
        'packages/webview-client/src/generated/framework-css/frameworkCssLoader.ts'
      );
      writeGeneratedFile(
        tempDir,
        'packages/webview-client/src/generated/shim-barrels/generic/index.ts'
      );
      writeGeneratedFile(
        tempDir,
        'packages/webview-client/src/generated/shim-barrels/docusaurus/index.ts'
      );
      writeGeneratedFile(
        tempDir,
        'packages/webview-client/src/generated/shim-barrels/starlight/index.ts'
      );
      writeGeneratedFile(
        tempDir,
        'packages/webview-client/src/generated/shim-barrels/nextra/index.ts'
      );
      writeGeneratedFile(
        tempDir,
        'packages/webview-client/src/generated/shim-barrels/nextjs/index.ts'
      );

      // create a rogue generated file in wrong location
      writeGeneratedFile(tempDir, 'packages/extension-host/src/rogue.ts');

      const result = runCheck(tempDir);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('unexpected locations');
      expect(result.stderr).toContain('rogue.ts');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails when expected generated files are missing', () => {
    const tempDir = createTempDir();
    try {
      // create only 2 of the expected 8 files
      writeGeneratedFile(
        tempDir,
        'packages/webview-client/src/generated/preload/preload.generated.ts'
      );
      writeGeneratedFile(
        tempDir,
        'packages/webview-client/src/generated/preload/aliases.generated.ts'
      );

      // add a non-generated file to avoid "no generated files found"
      writeNonGeneratedFile(tempDir, 'packages/something/src/normal.ts');

      const result = runCheck(tempDir);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Expected generated files missing');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('passes when all expected files are present & in correct location', () => {
    const tempDir = createTempDir();
    try {
      // create all 8 expected generated files
      const expectedFiles = [
        'packages/webview-client/src/generated/preload/preload.generated.ts',
        'packages/webview-client/src/generated/preload/aliases.generated.ts',
        'packages/webview-client/src/generated/framework-css/frameworkCssLoader.ts',
        'packages/webview-client/src/generated/shim-barrels/generic/index.ts',
        'packages/webview-client/src/generated/shim-barrels/docusaurus/index.ts',
        'packages/webview-client/src/generated/shim-barrels/starlight/index.ts',
        'packages/webview-client/src/generated/shim-barrels/nextra/index.ts',
        'packages/webview-client/src/generated/shim-barrels/nextjs/index.ts',
      ];

      for (const file of expectedFiles) {
        writeGeneratedFile(tempDir, file);
      }

      const result = runCheck(tempDir);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('8 expected, 8 found');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
