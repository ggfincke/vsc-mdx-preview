// tests/extension/framework/FrameworkDetector.test.ts
// unit tests for framework detection

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FrameworkDetector } from '../../../packages/extension-host/src/features/framework/FrameworkDetector';
import { Uri } from 'vscode';

const { mockConfigManager } = vi.hoisted(() => ({
  mockConfigManager: {
    get: vi.fn(() => 'auto'),
    onDidChangeKey: vi.fn(() => ({ dispose: vi.fn() })),
  },
}));

vi.mock('../../../packages/extension-host/src/app/services', () => ({
  getConfigManager: () => mockConfigManager,
  getErrorReporter: () => ({ reportSilent: vi.fn() }),
}));

vi.mock('../../../packages/extension-host/src/shared/logging/logger', () => ({
  debug: vi.fn(),
  createTaggedLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('FrameworkDetector', () => {
  beforeEach(() => {
    FrameworkDetector.reset();
    mockConfigManager.get.mockReturnValue('auto');
  });

  afterEach(() => {
    FrameworkDetector.reset();
  });

  it('detects Docusaurus before other frameworks', () => {
    const workspaceRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'mdx-preview-fw-')
    );
    tempDirs.push(workspaceRoot);

    fs.writeFileSync(
      path.join(workspaceRoot, 'package.json'),
      JSON.stringify({
        dependencies: {
          '@docusaurus/core': '^3.0.0',
          nextra: '^2.0.0',
        },
      }),
      'utf-8'
    );

    const detector = FrameworkDetector.getInstance();
    const result = detector.detectFromPackageJson(workspaceRoot);

    expect(result.framework).toBe('docusaurus');
    expect(result.detected).toBe(true);
  });

  it('detects Nextra before Next.js when both are present', () => {
    const workspaceRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'mdx-preview-fw-')
    );
    tempDirs.push(workspaceRoot);

    fs.writeFileSync(
      path.join(workspaceRoot, 'package.json'),
      JSON.stringify({
        dependencies: {
          nextra: '^2.0.0',
          next: '^13.0.0',
          '@next/mdx': '^14.0.0',
        },
      }),
      'utf-8'
    );

    const detector = FrameworkDetector.getInstance();
    const result = detector.detectFromPackageJson(workspaceRoot);

    expect(result.framework).toBe('nextra');
  });

  it('requires secondary dependency for Next.js detection', () => {
    const workspaceRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'mdx-preview-fw-')
    );
    tempDirs.push(workspaceRoot);

    fs.writeFileSync(
      path.join(workspaceRoot, 'package.json'),
      JSON.stringify({ dependencies: { next: '^13.0.0' } }),
      'utf-8'
    );

    const detector = FrameworkDetector.getInstance();
    const result = detector.detectFromPackageJson(workspaceRoot);

    expect(result.framework).toBe('generic');
  });

  it('detects Next.js when secondary dependency is present', () => {
    const workspaceRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'mdx-preview-fw-')
    );
    tempDirs.push(workspaceRoot);

    fs.writeFileSync(
      path.join(workspaceRoot, 'package.json'),
      JSON.stringify({
        dependencies: { next: '^13.0.0', '@next/mdx': '^14.0.0' },
      }),
      'utf-8'
    );

    const detector = FrameworkDetector.getInstance();
    const result = detector.detectFromPackageJson(workspaceRoot);

    expect(result.framework).toBe('nextjs');
  });

  it('respects manual framework override', () => {
    mockConfigManager.get.mockReturnValue('starlight');

    const detector = FrameworkDetector.getInstance();
    const result = detector.getFramework(Uri.file('/workspace/docs.mdx'));

    expect(result.framework).toBe('starlight');
    expect(result.detected).toBe(false);
  });

  it('returns shim enabled state from settings', () => {
    mockConfigManager.get.mockImplementation((key: string) => {
      if (key === 'framework.componentShims') return false;
      return 'auto';
    });

    const detector = FrameworkDetector.getInstance();
    const enabled = detector.areShimsEnabled(Uri.file('/workspace/docs.mdx'));

    expect(enabled).toBe(false);
  });
});
