import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptPath = path.resolve(__dirname, '../scripts/fix-esm-import-specifiers.mjs');

function writeFixture(esmDir: string): void {
  fs.mkdirSync(path.join(esmDir, 'sub'), { recursive: true });
  fs.mkdirSync(path.join(esmDir, 'subdir'), { recursive: true });

  fs.writeFileSync(
    path.join(esmDir, 'main.js'),
    [
      "export { value } from './sub/module';",
      "export * from './subdir';",
      "const loadAsync = () => import('./sub/async');",
      'void loadAsync;',
      '',
    ].join('\n'),
    'utf8'
  );
  fs.writeFileSync(path.join(esmDir, 'sub', 'module.js'), 'export const value = 1;\n', 'utf8');
  fs.writeFileSync(path.join(esmDir, 'sub', 'async.js'), 'export const asyncValue = 2;\n', 'utf8');
  fs.writeFileSync(path.join(esmDir, 'subdir', 'index.js'), 'export const ok = true;\n', 'utf8');
}

describe('fix-esm-import-specifiers script', () => {
  it('fails check mode before rewrite and passes after rewrite', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdx-tools-esm-spec-'));
    const esmDir = path.join(tempDir, 'esm');
    try {
      writeFixture(esmDir);

      const env = { ...process.env, MDX_TOOLS_ESM_DIR: esmDir };

      expect(() =>
        execFileSync('node', [scriptPath, '--check'], {
          env,
          encoding: 'utf8',
          stdio: 'pipe',
        })
      ).toThrow();

      execFileSync('node', [scriptPath], {
        env,
        encoding: 'utf8',
        stdio: 'pipe',
      });

      const rewrittenMain = fs.readFileSync(path.join(esmDir, 'main.js'), 'utf8');
      expect(rewrittenMain).toContain("from './sub/module.js'");
      expect(rewrittenMain).toContain("from './subdir/index.js'");
      expect(rewrittenMain).toContain("import('./sub/async.js')");

      const checkOutput = execFileSync('node', [scriptPath, '--check'], {
        env,
        encoding: 'utf8',
        stdio: 'pipe',
      });
      expect(checkOutput).toContain('ESM import/export specifiers are valid');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
