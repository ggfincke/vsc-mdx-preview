// tests/extension/diagnostics/ComponentDiagnostics.test.ts
// adapter tests: code locks, range mapping, composed update, publisher merge

import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  ComponentDiagnostics,
  DIAGNOSTIC_CODES,
  readDiagnosticCode,
} from '../../../packages/extension-host/src/features/diagnostics/ComponentDiagnostics';
import {
  DiagnosticPublisher,
  fromVsRange,
  toVsDiagnostic,
  toVsRange,
  toVsSeverity,
} from '../../../packages/extension-host/src/features/diagnostics/diagnostic-adapter';
import { EXTENSION_DISPLAY_NAME } from '../../../packages/extension-host/src/shared/constants';
import type { Diagnostic as MdxDiagnostic } from 'mdx-forge/diagnostics';
import { createMockDocument } from '../../helpers/mock-document';
import {
  mockConfigCache,
  mockErrorReporter,
  mockFrameworkDetector,
} from '../../helpers/mock-services';
import {
  Diagnostic,
  DiagnosticSeverity,
  Range,
  Uri,
  languages,
  workspace,
} from 'vscode';
import type { FrameworkChangeEvent } from '../../../packages/extension-host/src/features/framework/types';

const sampleDiagnostic: MdxDiagnostic = {
  code: 'MDXF001',
  ruleId: 'unknown-component',
  severity: 'warning',
  source: 'mdx-forge',
  message:
    'Unknown component "Frobnicate". Add it to .mdx-previewrc.json or use a built-in shim.',
  range: { start: { line: 3, column: 1 }, end: { line: 3, column: 12 } },
  data: { componentName: 'Frobnicate', suggestions: [] },
};

afterEach(() => {
  ComponentDiagnostics.reset();
  (workspace as unknown as { textDocuments: unknown[] }).textDocuments = [];
  vi.useRealTimers();
});

function withCode(code: unknown): Diagnostic {
  const d = new Diagnostic(
    new Range(0, 0, 0, 1),
    'm',
    DiagnosticSeverity.Warning
  );
  (d as { code?: unknown }).code = code;
  return d;
}

describe('readDiagnosticCode', () => {
  it('normalizes clickable, string, numeric & absent codes', () => {
    expect(readDiagnosticCode(withCode({ value: 'MDXF001' }))).toBe('MDXF001');
    expect(readDiagnosticCode(withCode('MDXF001'))).toBe('MDXF001');
    expect(readDiagnosticCode(withCode(5))).toBe('5');
    expect(readDiagnosticCode(withCode(undefined))).toBeUndefined();
  });
});

describe('range conversion', () => {
  it('converts 1-based ranges to 0-based & round-trips without drift', () => {
    const vs = toVsRange(sampleDiagnostic.range!);
    expect(vs.start.line).toBe(2);
    expect(vs.start.character).toBe(0);
    expect(vs.end.line).toBe(2);
    expect(vs.end.character).toBe(11);

    const original = new Range(7, 3, 7, 19);
    const back = toVsRange(fromVsRange(original));
    expect(back.start.line).toBe(7);
    expect(back.start.character).toBe(3);
    expect(back.end.line).toBe(7);
    expect(back.end.character).toBe(19);
  });
});

describe('toVsDiagnostic', () => {
  it('maps message, severity, source, range, data & a clickable code', () => {
    expect(toVsSeverity('error')).toBe(DiagnosticSeverity.Error);
    expect(toVsSeverity('warning')).toBe(DiagnosticSeverity.Warning);
    expect(toVsSeverity('info')).toBe(DiagnosticSeverity.Information);
    expect(toVsSeverity('hint')).toBe(DiagnosticSeverity.Hint);

    const vs = toVsDiagnostic(sampleDiagnostic);
    expect(vs.severity).toBe(DiagnosticSeverity.Warning);
    expect(vs.source).toBe(EXTENSION_DISPLAY_NAME);
    expect(vs.message).toContain('Frobnicate');
    expect(readDiagnosticCode(vs)).toBe('MDXF001');
    expect(vs.range.start.line).toBe(2);
    expect(vs.range.start.character).toBe(0);
    expect((vs as unknown as { data: unknown }).data).toEqual({
      componentName: 'Frobnicate',
      suggestions: [],
    });
    expect(vs.relatedInformation).toHaveLength(1);
  });
});

describe('ComponentDiagnostics.updateDiagnostics', () => {
  it('publishes MDXF001 diagnostics on both paired tag-name tokens', async () => {
    mockConfigCache.get.mockReturnValue(null);
    (workspace as unknown as { textDocuments: unknown[] }).textDocuments = [];
    let frameworkChangeCallback:
      ((event: FrameworkChangeEvent) => void) | undefined;
    mockFrameworkDetector.subscribe.mockImplementation((callback) => {
      frameworkChangeCallback = callback;
      return { dispose: vi.fn() };
    });

    const service = ComponentDiagnostics.getInstance();
    const document = createMockDocument(
      '<Frobnicate>\nimportant children\n</Frobnicate>\n'
    );

    await service.updateDiagnostics(document as any);

    const diagnostics = service.getDiagnostics(document.uri);
    expect(mockErrorReporter.reportSilent).not.toHaveBeenCalled();
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.map(readDiagnosticCode)).toEqual([
      DIAGNOSTIC_CODES.UNKNOWN_COMPONENT,
      DIAGNOSTIC_CODES.UNKNOWN_COMPONENT,
    ]);
    expect(diagnostics.map((diagnostic) => diagnostic.range)).toEqual([
      new Range(0, 1, 0, 11),
      new Range(2, 2, 2, 12),
    ]);
    expect((diagnostics[0] as unknown as { data: unknown }).data).toEqual({
      componentName: 'Frobnicate',
      suggestions: [],
      tagNameRanges: [new Range(0, 1, 0, 11), new Range(2, 2, 2, 12)],
    });

    const rootADocument = createMockDocument('# A', {
      fsPath: '/workspace-a/docs/a.mdx',
    });
    const rootBDocument = createMockDocument('# B', {
      fsPath: '/workspace-b/docs/b.mdx',
    });
    const nonMdxDocument = createMockDocument('plain text', {
      fsPath: '/workspace-b/docs/readme.md',
      languageId: 'markdown',
    });
    (workspace as unknown as { textDocuments: unknown[] }).textDocuments = [
      rootADocument,
      rootBDocument,
      nonMdxDocument,
    ];
    vi.useFakeTimers();
    const updateSpy = vi
      .spyOn(service, 'updateDiagnostics')
      .mockResolvedValue(undefined);

    frameworkChangeCallback?.({ affectedRoot: '/workspace-b' });
    vi.advanceTimersByTime(500);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenLastCalledWith(rootBDocument);

    updateSpy.mockClear();
    frameworkChangeCallback?.({});
    vi.advanceTimersByTime(500);
    expect(updateSpy).toHaveBeenCalledTimes(2);
    expect(updateSpy.mock.calls.map(([updated]) => updated)).toEqual([
      rootADocument,
      rootBDocument,
    ]);
  });
});

describe('DiagnosticPublisher', () => {
  it('merges analysis & compile producers for the same uri', () => {
    const collection = languages.createDiagnosticCollection('test');
    const publisher = new DiagnosticPublisher(collection);
    const uri = Uri.file('/workspace/doc.mdx');

    const analysis = new Diagnostic(
      new Range(0, 0, 0, 1),
      'analysis',
      DiagnosticSeverity.Warning
    );
    const compile = new Diagnostic(
      new Range(1, 0, 1, 1),
      'compile',
      DiagnosticSeverity.Error
    );

    publisher.set(uri, 'analysis', [analysis]);
    publisher.set(uri, 'compile', [compile]);
    expect(publisher.get(uri)).toEqual([analysis, compile]);

    // re-setting one producer must not erase the other
    publisher.set(uri, 'analysis', []);
    expect(publisher.get(uri)).toEqual([compile]);

    publisher.delete(uri);
    expect(publisher.get(uri)).toEqual([]);
  });
});
