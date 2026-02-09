// packages/extension/types/tailwind/detector.ts
// type definitions for Tailwind CSS detection

import type * as vscode from 'vscode';

// version info for detected Tailwind installation
export interface TailwindVersionInfo {
  version: string | null;
  major: number | null;
  modulePath?: string;
}

// result of Tailwind detection
export interface TailwindDetectionResult {
  workspaceRoot: string | null;
  configPath: string | null;
  entryCssPath: string | null;
}

// options for resolving workspace root
export interface ResolveWorkspaceRootOptions {
  docUri: vscode.Uri;
  entryDir?: string | null;
}

// options for resolving config path
export interface ResolveConfigPathOptions {
  entryDir?: string | null;
  workspaceRoot?: string | null;
  configOverride?: string;
  configDir?: string;
}

// options for resolving entry CSS path
export interface ResolveEntryCssPathOptions {
  workspaceRoot: string | null;
  entryDir: string | null;
  maxCssFilesToSearch?: number;
}
