// packages/extension/test/__mocks__/vscode.ts
// Mock implementation of VS Code API for unit tests

import { vi } from 'vitest';

// Mock Uri class
export class Uri {
  readonly scheme: string;
  readonly authority: string;
  readonly path: string;
  readonly query: string;
  readonly fragment: string;
  readonly fsPath: string;

  private constructor(
    scheme: string,
    authority: string,
    path: string,
    query: string,
    fragment: string
  ) {
    this.scheme = scheme;
    this.authority = authority;
    this.path = path;
    this.query = query;
    this.fragment = fragment;
    this.fsPath = path;
  }

  static file(path: string): Uri {
    return new Uri('file', '', path, '', '');
  }

  static parse(value: string): Uri {
    try {
      const url = new URL(value);
      return new Uri(
        url.protocol.replace(':', ''),
        url.host,
        url.pathname,
        url.search.replace('?', ''),
        url.hash.replace('#', '')
      );
    } catch {
      return new Uri('file', '', value, '', '');
    }
  }

  toString(): string {
    return `${this.scheme}://${this.authority}${this.path}`;
  }

  with(change: {
    scheme?: string;
    authority?: string;
    path?: string;
    query?: string;
    fragment?: string;
  }): Uri {
    return new Uri(
      change.scheme ?? this.scheme,
      change.authority ?? this.authority,
      change.path ?? this.path,
      change.query ?? this.query,
      change.fragment ?? this.fragment
    );
  }
}

// Mock Position class
export class Position {
  constructor(
    public readonly line: number,
    public readonly character: number
  ) {}
}

// Mock Range class
export class Range {
  constructor(
    public readonly start: Position,
    public readonly end: Position
  ) {}
}

// Mock Disposable class
export class Disposable {
  private disposed = false;
  constructor(private callOnDispose: () => void) {}

  dispose(): void {
    if (!this.disposed) {
      this.disposed = true;
      this.callOnDispose();
    }
  }

  static from(...disposables: { dispose(): unknown }[]): Disposable {
    return new Disposable(() => {
      disposables.forEach((d) => d.dispose());
    });
  }
}

// Mock EventEmitter class
export class EventEmitter<T> {
  private listeners: ((e: T) => void)[] = [];

  event = (listener: (e: T) => void): Disposable => {
    this.listeners.push(listener);
    return new Disposable(() => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    });
  };

  fire(data: T): void {
    this.listeners.forEach((listener) => listener(data));
  }

  dispose(): void {
    this.listeners = [];
  }
}

// Mock workspace
export const workspace = {
  isTrusted: true,
  workspaceFolders: [
    { uri: Uri.file('/workspace'), name: 'workspace', index: 0 },
  ],
  getConfiguration: vi.fn((section?: string) => ({
    get: vi.fn((key: string, defaultValue?: unknown) => {
      if (section === 'mdx-preview') {
        if (key === 'preview.enableScripts') return true;
        if (key === 'preview.security') return 'strict';
        if (key === 'preview.openMdxLinksInPreview') return true;
      }
      return defaultValue;
    }),
    update: vi.fn(),
    has: vi.fn(() => true),
    inspect: vi.fn(),
  })),
  onDidChangeWorkspaceTrust: vi.fn(() => new Disposable(() => {})),
  onDidGrantWorkspaceTrust: vi.fn(() => new Disposable(() => {})),
  onDidChangeConfiguration: vi.fn(() => new Disposable(() => {})),
  onDidChangeWorkspaceFolders: vi.fn(() => new Disposable(() => {})),
  openTextDocument: vi.fn(),
  fs: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    stat: vi.fn(),
  },
};

// Mock window
export const window = {
  showTextDocument: vi.fn(),
  showInformationMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  showQuickPick: vi.fn(),
  createWebviewPanel: vi.fn(),
  // ColorThemeKind.Dark
  activeColorTheme: { kind: 2 },
  onDidChangeActiveColorTheme: vi.fn(() => new Disposable(() => {})),
};

// Mock env
export const env = {
  remoteName: undefined as string | undefined,
  openExternal: vi.fn(),
  appName: 'Visual Studio Code',
  appRoot: '/app',
  uriScheme: 'vscode',
  language: 'en',
};

// Mock commands
export const commands = {
  executeCommand: vi.fn(),
  registerCommand: vi.fn(() => new Disposable(() => {})),
};

// Mock ConfigurationTarget enum
export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

// Mock ColorThemeKind enum
export enum ColorThemeKind {
  Light = 1,
  Dark = 2,
  HighContrast = 3,
  HighContrastLight = 4,
}

// Mock TextDocumentShowOptions
export interface TextDocumentShowOptions {
  viewColumn?: number;
  preserveFocus?: boolean;
  preview?: boolean;
  selection?: Range;
}

// Mock WebviewPanel
export class WebviewPanel {
  webview = {
    html: '',
    cspSource: 'https://example.com',
    onDidReceiveMessage: vi.fn(() => new Disposable(() => {})),
    postMessage: vi.fn(),
    asWebviewUri: vi.fn((uri: Uri) => uri),
  };
  onDidDispose = vi.fn(() => new Disposable(() => {}));
  onDidChangeViewState = vi.fn(() => new Disposable(() => {}));
  dispose = vi.fn();
  reveal = vi.fn();
  visible = true;
  active = true;
  viewColumn = 1;
}

// Default export for module
export default {
  Uri,
  Position,
  Range,
  Disposable,
  EventEmitter,
  workspace,
  window,
  env,
  commands,
  ConfigurationTarget,
  ColorThemeKind,
  WebviewPanel,
};
