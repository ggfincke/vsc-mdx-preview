// tests/extension/diagnostics/ComponentCodeActions.test.ts
// unit tests for component code actions

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockErrorReporter } from '../../helpers/mock-services';

const {
  mockFindUp,
  mockReadJsonSync,
  mockWriteFileSync,
} = vi.hoisted(() => ({
  mockFindUp: vi.fn(),
  mockReadJsonSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
}));

vi.mock(
  '../../../packages/extension-host/src/shared/utils/find-up',
  () => ({
    findUp: mockFindUp,
    createWorkspaceStopPredicate: vi.fn(() => () => false),
  })
);

vi.mock(
  '../../../packages/extension-host/src/shared/utils/file-utils',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../../packages/extension-host/src/shared/utils/file-utils')
    >()),
    readJsonSync: mockReadJsonSync,
  })
);

vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  writeFileSync: mockWriteFileSync,
}));

import {
  addComponentToConfig,
  ComponentCodeActionsProvider,
} from '../../../packages/extension-host/src/features/diagnostics/ComponentCodeActions';
import { DIAGNOSTIC_CODES } from '../../../packages/extension-host/src/features/diagnostics/ComponentDiagnostics';
import { analyzeUnknownComponents } from 'mdx-forge/diagnostics/analyze';
import { Diagnostic, DiagnosticSeverity, Range, Uri, workspace } from 'vscode';

const provider = new ComponentCodeActionsProvider();

function createDiagnostic(
  name: string,
  message = `Unknown component "${name}". Add it to .mdx-previewrc.json or use a built-in shim.`,
  tagNameRanges?: Range[]
): Diagnostic {
  const range = tagNameRanges?.[0] ?? new Range(0, 0, 0, name.length);
  const diagnostic = new Diagnostic(range, message, DiagnosticSeverity.Warning);
  diagnostic.code = DIAGNOSTIC_CODES.UNKNOWN_COMPONENT;
  diagnostic.data = { componentName: name, tagNameRanges };
  return diagnostic;
}

describe('ComponentCodeActionsProvider', () => {
  beforeEach(() => {
    workspace.workspaceFolders = [{ uri: Uri.file('/workspace') }];
    mockFindUp.mockReturnValue(undefined);
  });

  it('returns quick fixes for unknown components', () => {
    const source = '<note>important children</note>';
    const tagNameRanges = [
      new Range(0, 1, 0, 5),
      new Range(
        0,
        source.lastIndexOf('note'),
        0,
        source.lastIndexOf('note') + 4
      ),
    ];
    const document = {
      uri: Uri.file('/workspace/docs.mdx'),
    } as any;

    const actions = provider.provideCodeActions(
      document,
      new Range(0, 0, 0, 4),
      { diagnostics: [createDiagnostic('note', undefined, tagNameRanges)] },
      {} as any
    );

    expect(actions).toHaveLength(3);

    const addAction = actions.find((action) =>
      action.title.includes('.mdx-previewrc.json')
    );
    const builtinAction = actions.find((action) =>
      action.title.includes('Use built-in')
    );
    const learnAction = actions.find((action) =>
      action.title.includes('Learn about component mapping')
    );

    expect(addAction?.command?.command).toBe(
      'mdx-preview.addComponentToConfig'
    );
    expect(builtinAction?.edit?.edits).toEqual([
      { uri: document.uri, range: tagNameRanges[0], newText: 'Callout' },
      { uri: document.uri, range: tagNameRanges[1], newText: 'Callout' },
    ]);
    const updated = [...(builtinAction?.edit?.edits ?? [])]
      .sort(
        (left, right) =>
          right.range.start.character - left.range.start.character
      )
      .reduce(
        (text, edit) =>
          text.slice(0, edit.range.start.character) +
          edit.newText +
          text.slice(edit.range.end.character),
        source
      );
    expect(updated).toBe('<Callout>important children</Callout>');
    expect(learnAction?.command?.command).toBe('vscode.open');
  });

  it('targets the nearest config found from a nested document', () => {
    const configPath = '/workspace/packages/docs/.mdx-previewrc.json';
    mockFindUp.mockReturnValue(configPath);
    const document = {
      uri: Uri.file('/workspace/packages/docs/content/page.mdx'),
    } as any;

    const actions = provider.provideCodeActions(
      document,
      new Range(0, 0, 0, 4),
      { diagnostics: [createDiagnostic('Widget')] },
      {} as any
    );

    const addAction = actions.find((action) =>
      action.title.includes('.mdx-previewrc.json')
    );
    expect(addAction?.command?.arguments).toEqual(['Widget', configPath]);
    expect(mockFindUp).toHaveBeenCalledWith(
      expect.objectContaining({
        startDir: '/workspace/packages/docs/content',
      })
    );
  });

  it('refuses to overwrite malformed config JSON', async () => {
    const configPath = '/workspace/.mdx-previewrc.json';
    mockReadJsonSync.mockReturnValue(null);

    await addComponentToConfig('Widget', configPath);

    expect(mockWriteFileSync).not.toHaveBeenCalled();
    expect(mockErrorReporter.reportToUser).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'CONFIG_PARSE_ERROR',
        configPath,
      }),
      expect.anything()
    );
  });

  it('falls back from the current mdx-forge message when data is absent', () => {
    const document = {
      uri: Uri.file('/workspace/docs.mdx'),
    } as any;
    const [engineDiagnostic] = analyzeUnknownComponents(
      [
        {
          name: 'note',
          root: 'note',
          members: [],
          attributes: [],
          range: { start: { line: 1, column: 1 }, end: { line: 1, column: 5 } },
        },
      ],
      {
        imports: new Set(),
        configComponents: new Set(),
        framework: 'generic',
      }
    );

    const diagnostic = createDiagnostic('ignored', engineDiagnostic.message);
    delete diagnostic.data;
    const actions = provider.provideCodeActions(
      document,
      new Range(0, 0, 0, 4),
      { diagnostics: [diagnostic] },
      {} as any
    );

    const addAction = actions.find((action) =>
      action.title.includes('.mdx-previewrc.json')
    );
    expect(addAction?.command?.arguments?.[0]).toBe('note');
  });
});
