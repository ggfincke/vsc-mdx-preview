// tests/helpers/mock-document.ts
// Lightweight TextDocument mock for tests

import { Uri } from 'vscode';

export interface MockDocumentOptions {
  fsPath?: string;
  languageId?: string;
  scheme?: string;
}

export interface MockDocument {
  uri: {
    fsPath: string;
    scheme: string;
    path: string;
    toString(): string;
  };
  languageId: string;
  getText(): string;
  fileName: string;
  lineCount: number;
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

  return {
    uri: {
      fsPath,
      scheme,
      path: fsPath,
      toString: () => `${scheme}://${fsPath}`,
    },
    languageId,
    getText: () => content,
    fileName: fsPath,
    lineCount: content.split('\n').length,
  };
}
