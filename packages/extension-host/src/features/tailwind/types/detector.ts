// packages/extension-host/src/features/tailwind/types/detector.ts
// type definitions for Tailwind CSS detection

import type * as vscode from 'vscode';

// version info for detected Tailwind installation
export interface TailwindVersionInfo {
  version: string | null;
  major: number | null;
  modulePath?: string;
}

// capability-routed Tailwind profiles (Phase 8)
export type TailwindProfile = 'browser' | 'advanced';

// profile detection result used to route browser vs advanced Tailwind paths
export interface TailwindProfileDetectionResult {
  profile: TailwindProfile;
  reason: string;
  workspaceRoot: string | null;
  configPath: string | null;
  entryCssPath: string | null;
  hasTailwindInput: boolean;
  inlineTailwindStyles: string[];
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

// options for routing Tailwind to browser or advanced profile
export interface DetectTailwindProfileOptions {
  workspaceRoot: string | null;
  entryDir: string | null;
  configOverride?: string;
  configDir?: string;
  maxCssFilesToSearch?: number;
  mdxText?: string;
}
