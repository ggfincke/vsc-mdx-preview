// tests/extension/framework/FrameworkDetector.test.ts
// unit tests for framework detection

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FrameworkDetector } from '../../../packages/extension-host/src/features/framework/FrameworkDetector';
import * as vscode from 'vscode';
import { mockConfigManager } from '../../helpers/mock-services';

const tempDirs: string[] = [];

afterEach(() => {
  vscode.workspace.workspaceFolders = [];
  (vscode.window as any).activeTextEditor = undefined;
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

  it('respects manual framework override', () => {
    mockConfigManager.get.mockReturnValue('starlight');

    const detector = FrameworkDetector.getInstance();
    const result = detector.getFramework(
      vscode.Uri.file('/workspace/docs.mdx')
    );

    expect(result.framework).toBe('starlight');
    expect(result.detected).toBe(false);

    // facade delegates to canonical metadata (FW-THIN-DELEGATION)
    expect(detector.getFrameworkDisplayName('starlight')).toBe('Starlight');
    expect(detector.getFrameworkDisplayName('docusaurus')).toBe('Docusaurus');

    detector.dispose();
    mockConfigManager.get.mockReturnValue('auto');
    let onFrameworkSettingChange: (() => void) | undefined;
    mockConfigManager.onDidChangeKey.mockImplementation((_key, callback) => {
      onFrameworkSettingChange = callback;
      return { dispose: vi.fn() };
    });
    const activeWorkspaceRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'mdx-preview-fw-')
    );
    const changedWorkspaceRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'mdx-preview-fw-')
    );
    tempDirs.push(activeWorkspaceRoot, changedWorkspaceRoot);
    const packagePath = path.join(changedWorkspaceRoot, 'package.json');
    fs.writeFileSync(packagePath, '{"dependencies":{}}', 'utf-8');
    const activeDocUri = vscode.Uri.file(
      path.join(activeWorkspaceRoot, 'page.mdx')
    );
    const changedDocUri = vscode.Uri.file(
      path.join(changedWorkspaceRoot, 'page.mdx')
    );
    vscode.workspace.workspaceFolders = [
      { uri: vscode.Uri.file(activeWorkspaceRoot) },
      { uri: vscode.Uri.file(changedWorkspaceRoot) },
    ];
    (vscode.window as any).activeTextEditor = {
      document: { uri: activeDocUri },
    };
    let onPackageChange: ((uri: vscode.Uri) => void) | undefined;
    vi.spyOn(vscode.workspace, 'createFileSystemWatcher').mockReturnValue({
      onDidChange: (callback) => {
        onPackageChange = callback;
        return { dispose: vi.fn() };
      },
      onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
      onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
      dispose: vi.fn(),
    } as never);
    const packageDetector = FrameworkDetector.getInstance();
    const subscriber = vi.fn();
    packageDetector.subscribe(subscriber);

    expect(packageDetector.getFramework(changedDocUri).framework).toBe(
      'generic'
    );
    fs.writeFileSync(
      packagePath,
      JSON.stringify({ dependencies: { nextra: '^4.0.0' } }),
      'utf-8'
    );
    onPackageChange?.(vscode.Uri.file(packagePath));

    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber).toHaveBeenLastCalledWith({
      affectedRoot: changedWorkspaceRoot,
    });
    expect(packageDetector.getFramework(changedDocUri).framework).toBe(
      'nextra'
    );

    (vscode.window as any).activeTextEditor = undefined;
    mockConfigManager.get.mockReturnValue('starlight');
    onFrameworkSettingChange?.();

    expect(subscriber).toHaveBeenCalledTimes(2);
    expect(subscriber).toHaveBeenLastCalledWith({});
  });
});
