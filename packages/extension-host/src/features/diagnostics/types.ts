// packages/extension-host/src/features/diagnostics/types.ts
// type definitions for component diagnostics system

import type * as vscode from 'vscode';
import type { FrameworkId } from 'mdx-forge/components/registry';

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
}

// structured payload on vscode.Diagnostic.data for unknown-component diagnostics
// lets code actions read the component name w/o re-parsing the message prose
export interface UnknownComponentDiagnosticData {
  // unknown component name
  componentName: string;
}

// mdast position (1-based line, 1-based column)
export interface MdastPosition {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

// MDX ESM node (imports/exports)
export interface MdxjsEsmNode {
  type: 'mdxjsEsm';
  value: string;
  position?: MdastPosition;
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
  // resolved framework for shim-aware classification (defaults to generic)
  framework?: FrameworkId;
}
