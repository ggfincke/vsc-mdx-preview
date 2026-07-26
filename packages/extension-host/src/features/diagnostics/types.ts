// packages/extension-host/src/features/diagnostics/types.ts
// type definitions for component diagnostics system

import type * as vscode from 'vscode';
import type { FrameworkId } from 'mdx-forge/components/registry';
import type { ComponentSource } from 'mdx-forge/diagnostics/analyze';
import type { UnknownComponentData } from 'mdx-forge/diagnostics';

export type { ComponentSource };

// detected JSX component in an MDX file
export interface DetectedComponent {
  // component name
  name: string;
  // opening tag-name range
  range: vscode.Range;
  // opening & optional closing tag-name ranges
  tagNameRanges: vscode.Range[];
  // component source
  source: ComponentSource;
  // has children
  hasChildren: boolean;
}

export type UnknownComponentDiagnosticData = UnknownComponentData & {
  tagNameRanges?: vscode.Range[];
};

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
