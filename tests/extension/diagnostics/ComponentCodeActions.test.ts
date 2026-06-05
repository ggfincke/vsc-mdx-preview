// tests/extension/diagnostics/ComponentCodeActions.test.ts
// unit tests for component code actions

import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentCodeActionsProvider } from '../../../packages/extension-host/src/features/diagnostics/ComponentCodeActions';
import { DIAGNOSTIC_CODES } from '../../../packages/extension-host/src/features/diagnostics/ComponentDiagnostics';
import { Diagnostic, DiagnosticSeverity, Range, Uri, workspace } from 'vscode';

const provider = new ComponentCodeActionsProvider();

function createDiagnostic(
  name: string,
  message = `Unknown component "${name}". Add to .mdx-previewrc.json or use a built-in shim.`
): Diagnostic {
  const range = new Range(0, 0, 0, name.length);
  const diagnostic = new Diagnostic(
    range,
    message,
    DiagnosticSeverity.Warning
  );
  diagnostic.code = DIAGNOSTIC_CODES.UNKNOWN_COMPONENT;
  diagnostic.data = { componentName: name };
  return diagnostic;
}

describe('ComponentCodeActionsProvider', () => {
  beforeEach(() => {
    workspace.workspaceFolders = [{ uri: Uri.file('/workspace') }];
  });

  it('returns quick fixes for unknown components', () => {
    const document = {
      uri: Uri.file('/workspace/docs.mdx'),
    } as any;

    const actions = provider.provideCodeActions(
      document,
      new Range(0, 0, 0, 4),
      { diagnostics: [createDiagnostic('note')] },
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
    expect(builtinAction?.edit?.edits[0]?.newText).toBe('Callout');
    expect(learnAction?.command?.command).toBe('vscode.open');
  });

  it('reads component name from structured data ignoring message prose', () => {
    const document = {
      uri: Uri.file('/workspace/docs.mdx'),
    } as any;

    const diagnostic = createDiagnostic('note', 'totally different prose');
    const actions = provider.provideCodeActions(
      document,
      new Range(0, 0, 0, 4),
      { diagnostics: [diagnostic] },
      {} as any
    );

    expect(actions).toHaveLength(3);
    const builtinAction = actions.find((action) =>
      action.title.includes('Use built-in')
    );
    expect(builtinAction?.edit?.edits[0]?.newText).toBe('Callout');
  });

  it('falls back to message text when diagnostic data is absent', () => {
    const document = {
      uri: Uri.file('/workspace/docs.mdx'),
    } as any;

    const diagnostic = createDiagnostic('note');
    delete diagnostic.data;
    const actions = provider.provideCodeActions(
      document,
      new Range(0, 0, 0, 4),
      { diagnostics: [diagnostic] },
      {} as any
    );

    expect(actions).toHaveLength(3);
    const addAction = actions.find((action) =>
      action.title.includes('.mdx-previewrc.json')
    );
    const builtinAction = actions.find((action) =>
      action.title.includes('Use built-in')
    );

    expect(addAction?.command?.arguments?.[0]).toBe('note');
    expect(builtinAction?.edit?.edits[0]?.newText).toBe('Callout');
  });
});
