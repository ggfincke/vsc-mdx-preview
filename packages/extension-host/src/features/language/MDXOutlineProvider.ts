// packages/extension-host/src/features/language/MDXOutlineProvider.ts
// tree data provider for MDX outline in preview mode

import * as vscode from 'vscode';
import { extractMDXSymbols } from './MDXSymbolProvider';
import { createTaggedLogger } from '../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';

const log = createTaggedLogger(LogTags.LANGUAGE);

// map SymbolKind to VS Code ThemeIcon ID
function symbolKindToIcon(kind: vscode.SymbolKind): string {
  switch (kind) {
    case vscode.SymbolKind.String:
      return 'symbol-string';
    case vscode.SymbolKind.Struct:
      return 'symbol-struct';
    case vscode.SymbolKind.Property:
      return 'symbol-property';
    case vscode.SymbolKind.Module:
      return 'symbol-module';
    case vscode.SymbolKind.Variable:
      return 'symbol-variable';
    default:
      return 'symbol-misc';
  }
}

// tree item wrapping a DocumentSymbol w/ navigation command
export class SymbolTreeItem extends vscode.TreeItem {
  constructor(
    public readonly symbol: vscode.DocumentSymbol,
    public readonly documentUri: vscode.Uri,
    public readonly snapshotGeneration: number
  ) {
    super(
      symbol.name,
      symbol.children.length > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None
    );
    this.description = symbol.detail || undefined;
    this.iconPath = new vscode.ThemeIcon(symbolKindToIcon(symbol.kind));
    this.command = {
      command: 'vscode.open',
      title: 'Go to Symbol',
      arguments: [documentUri, { selection: symbol.selectionRange }],
    };
  }
}

// * MDXOutlineProvider
// provide tree data for MDX preview outline panel
export class MDXOutlineProvider implements vscode.TreeDataProvider<SymbolTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    SymbolTreeItem | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private symbols: vscode.DocumentSymbol[] = [];
  private documentUri?: vscode.Uri;
  private snapshotGeneration = 0;

  getTreeItem(element: SymbolTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: SymbolTreeItem): SymbolTreeItem[] {
    if (
      !this.documentUri ||
      (element && element.snapshotGeneration !== this.snapshotGeneration)
    ) {
      return [];
    }

    const children = element ? element.symbol.children : this.symbols;
    return children.map(
      (sym) =>
        new SymbolTreeItem(sym, this.documentUri!, this.snapshotGeneration)
    );
  }

  // refresh outline from source document
  update(document: vscode.TextDocument): void {
    let symbols: vscode.DocumentSymbol[];

    try {
      symbols = extractMDXSymbols(document);
    } catch {
      log.debug('Failed to extract symbols for outline');
      symbols = [];
    }

    this.documentUri = document.uri;
    this.symbols = symbols;
    this.snapshotGeneration += 1;
    this._onDidChangeTreeData.fire();
  }

  // clear outline (e.g., when preview is closed)
  clear(): void {
    this.symbols = [];
    this.documentUri = undefined;
    this.snapshotGeneration += 1;
    this._onDidChangeTreeData.fire();
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
