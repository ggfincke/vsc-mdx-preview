// packages/extension-host/src/features/diagnostics/diagnostic-adapter.ts
// pure mapping between mdx-forge diagnostics & vscode + single collection owner

import * as vscode from 'vscode';
import {
  DIAGNOSTIC_CODES as MDXF_CODES,
  type Diagnostic,
  type DiagnosticRange,
  type DiagnosticSeverity,
} from 'mdx-forge/diagnostics';
import { EXTENSION_DISPLAY_NAME } from '../../shared/constants';

// diagnostic codes re-exported from mdx-forge so the value lives in one repo
export const DIAGNOSTIC_CODES = {
  UNKNOWN_COMPONENT: MDXF_CODES.UNKNOWN_COMPONENT,
} as const;

// diagnostic source name shown in the UI
const DIAGNOSTIC_SOURCE = EXTENSION_DISPLAY_NAME;

// docs anchor backing the clickable diagnostic code
const DOCS_URI =
  'https://github.com/ggfincke/vsc-mdx-preview/blob/main/docs/configuration.md#components';

// single anchor for v1; per-code anchors land w/ the docs page
export function docsUriForCode(_code: string): vscode.Uri {
  return vscode.Uri.parse(DOCS_URI);
}

// normalize a possibly-clickable { value, target } code to its string value
export function readDiagnosticCode(
  diagnostic: vscode.Diagnostic
): string | undefined {
  const { code } = diagnostic;
  if (typeof code === 'object' && code !== null) {
    return String(code.value);
  }
  if (typeof code === 'string' || typeof code === 'number') {
    return String(code);
  }
  return undefined;
}

// vscode 0-based range -> mdx-forge 1-based range
export function fromVsRange(range: vscode.Range): DiagnosticRange {
  return {
    start: { line: range.start.line + 1, column: range.start.character + 1 },
    end: { line: range.end.line + 1, column: range.end.character + 1 },
  };
}

// mdx-forge 1-based range -> vscode 0-based range
export function toVsRange(r: DiagnosticRange): vscode.Range {
  return new vscode.Range(
    r.start.line - 1,
    r.start.column - 1,
    r.end.line - 1,
    r.end.column - 1
  );
}

export function toVsSeverity(
  severity: DiagnosticSeverity
): vscode.DiagnosticSeverity {
  switch (severity) {
    case 'error':
      return vscode.DiagnosticSeverity.Error;
    case 'warning':
      return vscode.DiagnosticSeverity.Warning;
    case 'info':
      return vscode.DiagnosticSeverity.Information;
    case 'hint':
      return vscode.DiagnosticSeverity.Hint;
  }
}

// map an mdx-forge Diagnostic to a vscode.Diagnostic (UI source + clickable code)
export function toVsDiagnostic(d: Diagnostic): vscode.Diagnostic {
  const range = d.range ? toVsRange(d.range) : new vscode.Range(0, 0, 0, 0);
  const diagnostic = new vscode.Diagnostic(
    range,
    d.message,
    toVsSeverity(d.severity)
  );

  diagnostic.source = DIAGNOSTIC_SOURCE;
  // clickable code recovers the readability lost from the opaque MDXF id
  diagnostic.code = { value: d.code, target: docsUriForCode(d.code) };

  // Diagnostic.data is runtime-supported but absent from @types/vscode 1.90; cast
  if (d.data !== undefined) {
    (diagnostic as vscode.Diagnostic & { data?: unknown }).data = d.data;
  }

  diagnostic.relatedInformation = [
    new vscode.DiagnosticRelatedInformation(
      new vscode.Location(docsUriForCode(d.code), new vscode.Range(0, 0, 0, 0)),
      'Learn about component mapping'
    ),
  ];

  return diagnostic;
}

// diagnostic producers that may write the shared collection
export type DiagnosticProducer = 'analysis' | 'compile';

// ! single owner for the 'mdx-components' collection
// DiagnosticCollection.set replaces all items for a uri; merge producers here so
// the future Source-A (compile) slice can coexist w/ Source-B (analysis)
export class DiagnosticPublisher {
  private readonly byUri = new Map<
    string,
    Partial<Record<DiagnosticProducer, vscode.Diagnostic[]>>
  >();

  constructor(private readonly collection: vscode.DiagnosticCollection) {}

  set(
    uri: vscode.Uri,
    producer: DiagnosticProducer,
    diagnostics: vscode.Diagnostic[]
  ): void {
    const key = uri.toString();
    const current = this.byUri.get(key) ?? {};
    current[producer] = diagnostics;
    this.byUri.set(key, current);
    this.collection.set(uri, [
      ...(current.analysis ?? []),
      ...(current.compile ?? []),
    ]);
  }

  delete(uri: vscode.Uri): void {
    this.byUri.delete(uri.toString());
    this.collection.delete(uri);
  }

  clear(): void {
    this.byUri.clear();
    this.collection.clear();
  }

  get(uri: vscode.Uri): readonly vscode.Diagnostic[] {
    return this.collection.get(uri) ?? [];
  }
}
