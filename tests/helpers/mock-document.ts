// tests/helpers/mock-document.ts
// Lightweight TextDocument mock for tests

import { Range, Uri } from 'vscode';

export interface MockDocumentOptions {
  fsPath?: string;
  languageId?: string;
  scheme?: string;
}

export interface MockDocument {
  uri: Uri;
  languageId: string;
  getText(): string;
  fileName: string;
  lineCount: number;
  lineAt(line: number): {
    text: string;
    range: Range;
  };
}

export function createMockDocument(
  content: string,
  options: MockDocumentOptions = {}
): MockDocument {
  const {
    fsPath = '/workspace/test.mdx',
    languageId = 'mdx',
    scheme = 'file',
  } = options;
  const lines = content.split('\n');
  const uri =
    scheme === 'file' ? Uri.file(fsPath) : Uri.parse(`${scheme}://${fsPath}`);

  return {
    uri,
    languageId,
    getText: () => content,
    fileName: fsPath,
    lineCount: lines.length,
    lineAt: (line: number) => {
      const text = lines[Math.min(line, lines.length - 1)] ?? '';
      return {
        text,
        range: new Range(line, 0, line, text.length),
      };
    },
  };
}
