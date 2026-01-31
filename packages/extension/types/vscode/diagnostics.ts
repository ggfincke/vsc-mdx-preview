// packages/extension/types/vscode/diagnostics.ts
// type definitions for component diagnostics system

import type * as vscode from 'vscode';

// source of a known component
// - builtin: generic built-in shims (Callout, Tabs, etc.)
// - framework: framework shims (Docusaurus, Next.js, Starlight)
// - config: defined in .mdx-previewrc.json components field
// - import: explicitly imported in the MDX file
// - unknown: not recognized
export type ComponentSource =
  | 'builtin'
  | 'framework'
  | 'config'
  | 'import'
  | 'unknown';

// detected JSX component in an MDX file
export interface DetectedComponent {
  // component name (PascalCase identifier)
  name: string;
  // location in source file
  range: vscode.Range;
  // where this component is defined/provided
  source: ComponentSource;
  // whether this component has children
  hasChildren: boolean;
  // raw text of the JSX element
  rawText?: string;
}

// diagnostic info for an unknown component
export interface ComponentDiagnostic {
  // component name
  name: string;
  // location in source file
  range: vscode.Range;
  // severity level
  severity: vscode.DiagnosticSeverity;
  // human-readable message
  message: string;
  // diagnostic code for quick fixes
  code: string;
}

// result of component detection
export interface ComponentDetectionResult {
  // all detected JSX components
  components: DetectedComponent[];
  // detected imports (component name -> import path)
  imports: Map<string, string>;
  // any errors during detection
  errors: string[];
}

// options for component detection
export interface ComponentDetectionOptions {
  // include line/column position info
  includePositions?: boolean;
  // detect imports
  detectImports?: boolean;
}
