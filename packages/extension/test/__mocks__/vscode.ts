// packages/extension/test/__mocks__/vscode.ts
// VS Code API mock for Vitest tests - provides minimal implementations of VS Code APIs
import { vi } from 'vitest';

// Mock workspace trust state - can be modified in tests
let mockIsTrusted = false;

// Mock configuration values - can be modified in tests
const mockConfigValues: Record<string, unknown> = {
  'preview.enableScripts': false,
  'preview.security': 'strict',
};

// Mock workspace folders
let mockWorkspaceFolders: { uri: { fsPath: string } }[] = [
  { uri: { fsPath: '/projects/test-workspace' } },
];

// Event listeners storage
const trustChangeListeners: ((trusted: boolean) => void)[] = [];
const trustGrantListeners: (() => void)[] = [];
const configChangeListeners: ((e: {
  affectsConfiguration: (key: string) => boolean;
}) => void)[] = [];

// URI class mock
export class Uri {
  readonly fsPath: string;
  readonly scheme: string;
  readonly path: string;

  private constructor(fsPath: string) {
    this.fsPath = fsPath;
    this.scheme = 'file';
    this.path = fsPath;
  }

  static file(path: string): Uri {
    return new Uri(path);
  }

  static parse(value: string): Uri {
    return new Uri(value);
  }

  toString(): string {
    return this.fsPath;
  }
}

// Position class mock
export class Position {
  constructor(
    public readonly line: number,
    public readonly character: number
  ) {}
}

// Range class mock
export class Range {
  constructor(
    public readonly start: Position | number,
    public readonly end: Position | number,
    startChar?: number,
    endChar?: number
  ) {
    if (typeof start === 'number' && typeof end === 'number') {
      this.start = new Position(start, startChar ?? 0);
      this.end = new Position(end, endChar ?? 0);
    }
  }
}

// EndOfLine enum mock
export enum EndOfLine {
  LF = 1,
  CRLF = 2,
}

// Disposable mock
export class Disposable {
  constructor(private readonly callOnDispose: () => void) {}

  dispose(): void {
    this.callOnDispose();
  }
}

// Mock text document
export const createMockTextDocument = (options: {
  uri?: Uri;
  getText?: () => string;
  lineAt?: (line: number) => { text: string };
}) => ({
  uri: options.uri ?? Uri.file('/projects/test-workspace/test.mdx'),
  getText: options.getText ?? (() => '# Test'),
  lineAt: options.lineAt ?? (() => ({ text: '' })),
  lineCount: 10,
  fileName: options.uri?.fsPath ?? '/projects/test-workspace/test.mdx',
  languageId: 'mdx',
  version: 1,
  isDirty: false,
  isUntitled: false,
  isClosed: false,
  eol: EndOfLine.LF,
  save: vi.fn(),
  positionAt: vi.fn(() => new Position(0, 0)),
  offsetAt: vi.fn(() => 0),
  getWordRangeAtPosition: vi.fn(),
  validateRange: vi.fn((range: Range) => range),
  validatePosition: vi.fn((pos: Position) => pos),
});

// Workspace mock
export const workspace = {
  get isTrusted(): boolean {
    return mockIsTrusted;
  },

  get workspaceFolders() {
    return mockWorkspaceFolders;
  },

  getConfiguration(section?: string) {
    return {
      get<T>(key: string, defaultValue?: T): T {
        const fullKey = section ? `${key}` : key;
        const value = mockConfigValues[fullKey];
        return (value !== undefined ? value : defaultValue) as T;
      },
      update: vi.fn(),
      has: vi.fn(() => true),
      inspect: vi.fn(),
    };
  },

  fs: {
    readFile: vi.fn(async () => new Uint8Array()),
  },

  openTextDocument: vi.fn(async (pathOrUri: string | Uri) => {
    const fsPath = typeof pathOrUri === 'string' ? pathOrUri : pathOrUri.fsPath;
    return createMockTextDocument({ uri: Uri.file(fsPath) });
  }),

  onDidGrantWorkspaceTrust(listener: () => void): Disposable {
    trustGrantListeners.push(listener);
    return new Disposable(() => {
      const index = trustGrantListeners.indexOf(listener);
      if (index > -1) {
        trustGrantListeners.splice(index, 1);
      }
    });
  },

  onDidChangeWorkspaceTrust(listener: (trusted: boolean) => void): Disposable {
    trustChangeListeners.push(listener);
    return new Disposable(() => {
      const index = trustChangeListeners.indexOf(listener);
      if (index > -1) {
        trustChangeListeners.splice(index, 1);
      }
    });
  },

  onDidChangeConfiguration(
    listener: (e: { affectsConfiguration: (key: string) => boolean }) => void
  ): Disposable {
    configChangeListeners.push(listener);
    return new Disposable(() => {
      const index = configChangeListeners.indexOf(listener);
      if (index > -1) {
        configChangeListeners.splice(index, 1);
      }
    });
  },

  createFileSystemWatcher: vi.fn((globPattern: string) => ({
    onDidChange: vi.fn((listener: () => void) => new Disposable(() => {})),
    onDidCreate: vi.fn((listener: () => void) => new Disposable(() => {})),
    onDidDelete: vi.fn((listener: () => void) => new Disposable(() => {})),
    dispose: vi.fn(),
  })),
};

// Window mock
export const window = {
  createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(),
    show: vi.fn(),
    dispose: vi.fn(),
  })),
  showQuickPick: vi.fn(),
  showInformationMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  showTextDocument: vi.fn(),
  createStatusBarItem: vi.fn(() => ({
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
    text: '',
    tooltip: '',
    command: '',
  })),
};

// Commands mock
export const commands = {
  executeCommand: vi.fn(),
  registerCommand: vi.fn(() => new Disposable(() => {})),
};

// Env mock
export const env = {
  openExternal: vi.fn(),
  uriScheme: 'vscode',
  appName: 'Visual Studio Code',
};

// mock webview URI class that mimics VS Code's webview URI format
// used by asWebviewUri to return a proper URI-like object
class MockWebviewUri {
  private readonly _fsPath: string;

  constructor(fsPath: string) {
    this._fsPath = fsPath;
  }

  get fsPath(): string {
    return this._fsPath;
  }

  get scheme(): string {
    return 'https';
  }

  toString(): string {
    return `https://file+.vscode-resource.vscode-cdn.net${this._fsPath}`;
  }
}

// Webview mock for CSP tests
export const createMockWebview = () => ({
  cspSource: 'https://file+.vscode-resource.vscode-cdn.net',
  html: '',
  options: {},
  onDidReceiveMessage: vi.fn(),
  postMessage: vi.fn(),
  asWebviewUri: vi.fn((uri: Uri) => new MockWebviewUri(uri.fsPath)),
});

// Helper functions for tests to manipulate mock state
export const __setMockTrusted = (trusted: boolean): void => {
  mockIsTrusted = trusted;
};

export const __setMockConfig = (key: string, value: unknown): void => {
  mockConfigValues[key] = value;
};

export const __setMockWorkspaceFolders = (
  folders: { uri: { fsPath: string } }[]
): void => {
  mockWorkspaceFolders = folders;
};

export const __triggerTrustChange = (trusted = mockIsTrusted): void => {
  trustChangeListeners.forEach((listener) => listener(trusted));
  if (trusted) {
    trustGrantListeners.forEach((listener) => listener());
  }
};

export const __triggerConfigChange = (affectedKey: string): void => {
  configChangeListeners.forEach((listener) =>
    listener({
      affectsConfiguration: (key: string) => key === affectedKey,
    })
  );
};

export const __resetMocks = (): void => {
  mockIsTrusted = false;
  mockConfigValues['preview.enableScripts'] = false;
  mockConfigValues['preview.security'] = 'strict';
  mockWorkspaceFolders = [{ uri: { fsPath: '/projects/test-workspace' } }];
  trustChangeListeners.length = 0;
  trustGrantListeners.length = 0;
  configChangeListeners.length = 0;
};

// create enhanced webview mock w/ event handling for RPC tests
export const createMockWebviewWithEvents = () => {
  const messageListeners: ((message: unknown) => void)[] = [];

  return {
    cspSource: 'https://file+.vscode-resource.vscode-cdn.net',
    html: '',
    options: {},
    postMessage: vi.fn(),
    asWebviewUri: vi.fn((uri: Uri) => new MockWebviewUri(uri.fsPath)),
    onDidReceiveMessage: vi.fn(
      (
        listener: (message: unknown) => void,
        _thisArg?: unknown,
        _disposables?: Disposable[]
      ) => {
        messageListeners.push(listener);
        return new Disposable(() => {
          const index = messageListeners.indexOf(listener);
          if (index > -1) {
            messageListeners.splice(index, 1);
          }
        });
      }
    ),
    // helper to simulate receiving a message from webview
    __simulateMessage: (message: unknown) => {
      messageListeners.forEach((listener) => listener(message));
    },
    __getMessageListeners: () => messageListeners,
  };
};

// Export for module resolution
export default {
  Uri,
  Position,
  Range,
  EndOfLine,
  Disposable,
  workspace,
  window,
  commands,
  env,
};
