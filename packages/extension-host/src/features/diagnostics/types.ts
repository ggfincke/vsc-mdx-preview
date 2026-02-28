// packages/extension-host/src/features/diagnostics/types.ts
// type definitions for component diagnostics system

import type * as vscode from 'vscode';

// source of a known component (builtin shims, framework shims, config, import, or unknown)
export type ComponentSource =
  | 'builtin'
  | 'framework'
  | 'config'
  | 'import'
  | 'unknown';

// detected JSX component in an MDX file
export interface DetectedComponent {
  // component name
  name: string;
  // source range
  range: vscode.Range;
  // component source
  source: ComponentSource;
  // has children
  hasChildren: boolean;
  // raw JSX text
  rawText?: string;
}

// diagnostic info for an unknown component
export interface ComponentDiagnostic {
  // component name
  name: string;
  // source range
  range: vscode.Range;
  // severity
  severity: vscode.DiagnosticSeverity;
  // message
  message: string;
  // diagnostic code
  code: string;
}

// result of component detection
export interface ComponentDetectionResult {
  // detected components
  components: DetectedComponent[];
  // import map
  imports: Map<string, string>;
  // detection errors
  errors: string[];
}

// options for component detection
export interface ComponentDetectionOptions {
  // include positions
  includePositions?: boolean;
  // detect imports
  detectImports?: boolean;
}
