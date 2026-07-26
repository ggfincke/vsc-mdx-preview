// packages/extension-host/test/__mocks__/vscode.ts
// provide minimal vscode API for tests

type Disposable = { dispose: () => void };

type EventHandler<T> = (event: T) => void;

function createDisposable(onDispose?: () => void): Disposable {
  return {
    dispose: () => {
      onDispose?.();
    },
  };
}

export class EventEmitter<T> {
  private listeners = new Set<EventHandler<T>>();

  event = (listener: EventHandler<T>): Disposable => {
    this.listeners.add(listener);
    return createDisposable(() => this.listeners.delete(listener));
  };

  fire(event: T): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  dispose(): void {
    this.listeners.clear();
  }
}

export class Uri {
  scheme: string;
  fsPath: string;
  path: string;

  private constructor(scheme: string, fsPath: string) {
    this.scheme = scheme;
    this.fsPath = fsPath;
    this.path = fsPath;
  }

  static file(path: string): Uri {
    return new Uri('file', path);
  }

  static parse(uri: string): Uri {
    const url = new URL(uri);
    const scheme = url.protocol.replace(':', '');
    return new Uri(scheme, url.pathname);
  }

  toString(): string {
    return `${this.scheme}://${this.fsPath}`;
  }
}

export class RelativePattern {
  baseUri: Uri;
  base: string;
  pattern: string;

  constructor(base: Uri | string, pattern: string) {
    this.baseUri = typeof base === 'string' ? Uri.file(base) : base;
    this.base = this.baseUri.fsPath;
    this.pattern = pattern;
  }
}

export class Position {
  line: number;
  character: number;

  constructor(line: number, character: number) {
    this.line = line;
    this.character = character;
  }
}

export class Range {
  start: Position;
  end: Position;

  constructor(
    startLineOrPos: number | Position,
    startCharOrPos: number | Position,
    endLine?: number,
    endChar?: number
  ) {
    if (
      startLineOrPos instanceof Position &&
      startCharOrPos instanceof Position
    ) {
      this.start = startLineOrPos;
      this.end = startCharOrPos;
      return;
    }

    const startLine = startLineOrPos as number;
    const startChar = startCharOrPos as number;
    this.start = new Position(startLine, startChar);
    this.end = new Position(endLine ?? startLine, endChar ?? startChar);
  }
}

export class Selection extends Range {}

export enum TextEditorRevealType {
  Default = 0,
  InCenter = 1,
  InCenterIfOutsideViewport = 2,
  AtTop = 3,
}

export class Location {
  uri: Uri;
  range: Range;

  constructor(uri: Uri, range: Range) {
    this.uri = uri;
    this.range = range;
  }
}

export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

export class Diagnostic {
  range: Range;
  message: string;
  severity: DiagnosticSeverity;
  source?: string;
  code?: string;
  data?: unknown;
  relatedInformation?: DiagnosticRelatedInformation[];

  constructor(range: Range, message: string, severity: DiagnosticSeverity) {
    this.range = range;
    this.message = message;
    this.severity = severity;
  }
}

export class DiagnosticRelatedInformation {
  location: Location;
  message: string;

  constructor(location: Location, message: string) {
    this.location = location;
    this.message = message;
  }
}

class MockDiagnosticCollection {
  private data = new Map<string, Diagnostic[]>();

  set(uri: Uri, diagnostics: Diagnostic[]): void {
    this.data.set(uri.toString(), diagnostics);
  }

  get(uri: Uri): Diagnostic[] | undefined {
    return this.data.get(uri.toString());
  }

  delete(uri: Uri): void {
    this.data.delete(uri.toString());
  }

  clear(): void {
    this.data.clear();
  }

  dispose(): void {
    this.clear();
  }
}

export class WorkspaceEdit {
  edits: Array<{ uri: Uri; range: Range; newText: string }> = [];

  replace(uri: Uri, range: Range, newText: string): void {
    this.edits.push({ uri, range, newText });
  }
}

export class CodeAction {
  title: string;
  kind?: string;
  diagnostics?: Diagnostic[];
  isPreferred?: boolean;
  command?: { title: string; command: string; arguments?: unknown[] };
  edit?: WorkspaceEdit;

  constructor(title: string, kind?: string) {
    this.title = title;
    this.kind = kind;
  }
}

export const CodeActionKind = {
  QuickFix: 'quickfix',
};

export class FileSystemWatcher {
  private changeEmitter = new EventEmitter<Uri>();
  private createEmitter = new EventEmitter<Uri>();
  private deleteEmitter = new EventEmitter<Uri>();

  onDidChange(handler: EventHandler<Uri>): Disposable {
    return this.changeEmitter.event(handler);
  }

  onDidCreate(handler: EventHandler<Uri>): Disposable {
    return this.createEmitter.event(handler);
  }

  onDidDelete(handler: EventHandler<Uri>): Disposable {
    return this.deleteEmitter.event(handler);
  }

  fireChange(uri: Uri): void {
    this.changeEmitter.fire(uri);
  }

  fireCreate(uri: Uri): void {
    this.createEmitter.fire(uri);
  }

  fireDelete(uri: Uri): void {
    this.deleteEmitter.fire(uri);
  }

  dispose(): void {
    this.changeEmitter.dispose();
    this.createEmitter.dispose();
    this.deleteEmitter.dispose();
  }
}

export enum SymbolKind {
  File = 0,
  Module = 1,
  Namespace = 2,
  Package = 3,
  Class = 4,
  Method = 5,
  Property = 6,
  Field = 7,
  Constructor = 8,
  Enum = 9,
  Interface = 10,
  Function = 11,
  Variable = 12,
  Constant = 13,
  String = 14,
  Number = 15,
  Boolean = 16,
  Array = 17,
  Object = 18,
  Key = 19,
  Null = 20,
  EnumMember = 21,
  Struct = 22,
  Event = 23,
  Operator = 24,
  TypeParameter = 25,
}

export class DocumentSymbol {
  name: string;
  detail: string;
  kind: SymbolKind;
  range: Range;
  selectionRange: Range;
  children: DocumentSymbol[] = [];

  constructor(
    name: string,
    detail: string,
    kind: SymbolKind,
    range: Range,
    selectionRange: Range
  ) {
    this.name = name;
    this.detail = detail;
    this.kind = kind;
    this.range = range;
    this.selectionRange = selectionRange;
  }
}

export enum CompletionItemKind {
  Text = 0,
  Method = 1,
  Function = 2,
  Constructor = 3,
  Field = 4,
  Variable = 5,
  Class = 6,
  Interface = 7,
  Module = 8,
  Property = 9,
  Unit = 10,
  Value = 11,
  Enum = 12,
  Keyword = 13,
  Snippet = 14,
  Color = 15,
  File = 16,
  Reference = 17,
  Folder = 18,
  EnumMember = 19,
  Constant = 20,
  Struct = 21,
  Event = 22,
  Operator = 23,
  TypeParameter = 24,
}

export class CompletionItem {
  label: string;
  kind?: CompletionItemKind;
  detail?: string;
  documentation?: MarkdownString | string;
  sortText?: string;
  insertText?: string | SnippetString;
  command?: { title: string; command: string; arguments?: unknown[] };

  constructor(label: string, kind?: CompletionItemKind) {
    this.label = label;
    this.kind = kind;
  }
}

export class MarkdownString {
  value: string;

  constructor(value?: string) {
    this.value = value ?? '';
  }

  appendText(value: string): this {
    this.value += value;
    return this;
  }

  appendMarkdown(value: string): this {
    this.value += value;
    return this;
  }
}

export class SnippetString {
  value: string;

  constructor(value?: string) {
    this.value = value ?? '';
  }
}

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export class TreeItem {
  label?: string;
  collapsibleState?: TreeItemCollapsibleState;
  description?: string;
  iconPath?: ThemeIcon | Uri;
  command?: { command: string; title: string; arguments?: unknown[] };
  contextValue?: string;

  constructor(label: string, collapsibleState?: TreeItemCollapsibleState) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

export class ThemeIcon {
  id: string;

  constructor(id: string) {
    this.id = id;
  }
}

export const languages = {
  createDiagnosticCollection: (_name: string) => new MockDiagnosticCollection(),
  registerDocumentSymbolProvider: (
    _selector: any,
    _provider: any
  ): Disposable => createDisposable(),
  registerCompletionItemProvider: (
    _selector: any,
    _provider: any,
    ..._triggerChars: string[]
  ): Disposable => createDisposable(),
  registerCodeActionsProvider: (
    _selector: any,
    _provider: any,
    _metadata?: any
  ): Disposable => createDisposable(),
};

export const workspace = {
  workspaceFolders: [] as Array<{ uri: Uri }>,
  textDocuments: [] as Array<{
    uri: Uri;
    languageId?: string;
    fileName?: string;
    getText?: () => string;
  }>,
  isTrusted: true,
  onDidChangeConfiguration: (
    _handler: EventHandler<{ affectsConfiguration: (key: string) => boolean }>
  ): Disposable => {
    return createDisposable();
  },
  onDidChangeTextDocument: (
    _handler: EventHandler<{ document: any }>
  ): Disposable => {
    return createDisposable();
  },
  onDidOpenTextDocument: (_handler: EventHandler<any>): Disposable => {
    return createDisposable();
  },
  onDidCloseTextDocument: (_handler: EventHandler<any>): Disposable => {
    return createDisposable();
  },
  createFileSystemWatcher: (_pattern: any): FileSystemWatcher => {
    return new FileSystemWatcher();
  },
  openTextDocument: async (pathOrUri: string | Uri): Promise<any> => {
    const uri = typeof pathOrUri === 'string' ? Uri.file(pathOrUri) : pathOrUri;
    return {
      uri,
      fileName: uri.fsPath,
      getText: () => '',
      languageId: 'mdx',
    };
  },
  getWorkspaceFolder: (uri: Uri): { uri: Uri } | undefined => {
    return workspace.workspaceFolders.find((folder) =>
      uri.fsPath.startsWith(folder.uri.fsPath)
    );
  },
  fs: {
    writeFile: async (_uri: Uri, _content: Uint8Array): Promise<void> => {},
    readFile: async (_uri: Uri): Promise<Uint8Array> => new Uint8Array(),
    stat: async (_uri: Uri): Promise<unknown> => ({}),
  },
};

const activeEditorEmitter = new EventEmitter<any>();
const visibleRangesEmitter = new EventEmitter<any>();

export const window = {
  activeTextEditor: undefined as any,
  visibleTextEditors: [] as any[],
  showTextDocument: async (_doc: any, _options?: any): Promise<any> =>
    undefined,
  onDidChangeActiveTextEditor: (handler: EventHandler<any>): Disposable =>
    activeEditorEmitter.event(handler),
  onDidChangeTextEditorVisibleRanges: (
    handler: EventHandler<any>
  ): Disposable => visibleRangesEmitter.event(handler),
  showQuickPick: async (_items: any, _options?: any): Promise<any> => undefined,
  showSaveDialog: async (_options?: any): Promise<Uri | undefined> => undefined,
  showInformationMessage: async (
    _msg: string,
    ..._items: any[]
  ): Promise<any> => undefined,
  showWarningMessage: async (_msg: string, ..._items: any[]): Promise<any> =>
    undefined,
  showErrorMessage: async (_msg: string, ..._items: any[]): Promise<any> =>
    undefined,
  createTreeView: (_viewId: string, _options: any): any => ({
    dispose: () => {},
  }),
};

// trigger active editor change events for tests
export function __fireActiveTextEditorChange(editor: any): void {
  window.activeTextEditor = editor;
  activeEditorEmitter.fire(editor);
}

// trigger visible-range change events for tests
export function __fireTextEditorVisibleRangesChange(event: any): void {
  visibleRangesEmitter.fire(event);
}

export const commands = {
  executeCommand: async (
    _command: string,
    ..._args: unknown[]
  ): Promise<unknown> => undefined,
};

export const env = {
  remoteName: undefined as string | undefined,
  openExternal: async (_uri: Uri): Promise<boolean> => true,
  clipboard: {
    writeText: async (_text: string): Promise<void> => {},
    readText: async (): Promise<string> => '',
  },
};

export type TextDocumentShowOptions = {
  selection?: Range;
  preview?: boolean;
};

export type TextDocument = {
  uri: Uri;
  languageId: string;
  fileName: string;
  getText(): string;
};

export type CodeActionContext = {
  diagnostics: Diagnostic[];
};

export type CancellationToken = unknown;

export type GlobPattern = string;

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
  Two = 2,
}
