import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const scriptPath = path.resolve(
  process.cwd(),
  'scripts/check-library-publication-gate.mjs'
);

function runGateCheck(markdown: string, args: string[] = []) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-check-'));
  const gateFile = path.join(tempDir, 'library-publication-gate.md');
  fs.writeFileSync(gateFile, markdown, 'utf8');

  const result = spawnSync('node', [scriptPath, '--file', gateFile, ...args], {
    encoding: 'utf8',
  });

  fs.rmSync(tempDir, { recursive: true, force: true });
  return result;
}

describe('check-library-publication-gate', () => {
  it('passes when global gate is satisfied and package row is publish-ready', () => {
    const markdown = `# Gate

- Gate outcome: **SATISFIED**
- Publish posture: **Can publish**

| Package | Blame Audit | Relicense/Rewrite | LICENSE/NOTICE | Docs/API | Build/Test | Publish Ready |
| --- | --- | --- | --- | --- | --- | --- |
| \`mdx-tools\` | done | done | done | done | done | yes |
`;

    const result = runGateCheck(markdown, ['--package', 'mdx-tools']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Publication gate passed');
  });

  it('fails when global gate is not satisfied, even if package row says yes', () => {
    const markdown = `# Gate

- Gate outcome: **NOT SATISFIED**
- Publish posture: **Do not publish**

| Package | Blame Audit | Relicense/Rewrite | LICENSE/NOTICE | Docs/API | Build/Test | Publish Ready |
| --- | --- | --- | --- | --- | --- | --- |
| \`mdx-tools\` | done | done | done | done | done | yes |
`;

    const result = runGateCheck(markdown, ['--package', 'mdx-tools']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Publication gate check failed');
  });
});
