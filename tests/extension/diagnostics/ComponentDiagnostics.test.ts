// tests/extension/diagnostics/ComponentDiagnostics.test.ts
// unit tests for component diagnostics

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComponentDiagnostics } from '../../../packages/extension/diagnostics/ComponentDiagnostics';
import { Range, Uri } from 'vscode';

const { mockDetectComponents, mockGetUnknownComponents } = vi.hoisted(() => ({
  mockDetectComponents: vi.fn(),
  mockGetUnknownComponents: vi.fn(),
}));

vi.mock('../../../packages/extension/diagnostics/ComponentDetector', () => ({
  detectComponents: mockDetectComponents,
  getUnknownComponents: mockGetUnknownComponents,
  invalidateComponentCache: vi.fn(),
}));

vi.mock('../../../packages/extension/preview/config/ConfigResolver', () => ({
  resolveConfig: vi.fn(() => undefined),
}));

vi.mock('../../../packages/extension/logging', () => ({
  debug: vi.fn(),
  info: vi.fn(),
}));

describe('ComponentDiagnostics', () => {
  beforeEach(() => {
    ComponentDiagnostics.reset();
    mockDetectComponents.mockReset();
    mockGetUnknownComponents.mockReset();
  });

  afterEach(() => {
    ComponentDiagnostics.reset();
  });

  it('creates diagnostics for unknown components', async () => {
    const unknownComponent = {
      name: 'Missing',
      range: new Range(0, 0, 0, 7),
      source: 'unknown',
    };

    mockDetectComponents.mockResolvedValue({ components: [], imports: new Map(), errors: [] });
    mockGetUnknownComponents.mockReturnValue([unknownComponent]);

    const service = ComponentDiagnostics.getInstance();
    const document = {
      uri: Uri.file('/workspace/test.mdx'),
      languageId: 'mdx',
      fileName: '/workspace/test.mdx',
      getText: () => '<Missing />',
    } as any;

    await service.updateDiagnostics(document);

    const diagnostics = service.getDiagnostics(document.uri);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('Unknown component "Missing"');
  });
});
