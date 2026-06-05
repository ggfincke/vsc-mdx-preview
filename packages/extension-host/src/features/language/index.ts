// packages/extension-host/src/features/language/index.ts
// barrel exports & registration for language feature providers

import * as vscode from 'vscode';
import { MDXSymbolProvider } from './MDXSymbolProvider';
import { MDXCompletionProvider } from './MDXCompletionProvider';
import { MDXOutlineProvider } from './MDXOutlineProvider';
import { createTaggedLogger } from '../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import { EXTENSION_DISPLAY_NAME } from '../../shared/constants';

const log = createTaggedLogger(LogTags.LANGUAGE);

export { MDXSymbolProvider } from './MDXSymbolProvider';
export { MDXCompletionProvider } from './MDXCompletionProvider';
export { MDXOutlineProvider } from './MDXOutlineProvider';
export { extractMDXSymbols } from './MDXSymbolProvider';

// module-level accessor for outline provider (used by preview system)
let outlineProvider: MDXOutlineProvider | undefined;

export function getOutlineProvider(): MDXOutlineProvider | undefined {
  return outlineProvider;
}

// document selector for MDX files
const MDX_SELECTOR: vscode.DocumentSelector = {
  language: 'mdx',
  scheme: 'file',
};

// register language feature providers
export function registerLanguageProviders(
  context: vscode.ExtensionContext
): void {
  // register document symbol provider (outline, breadcrumbs, Cmd+Shift+O)
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      MDX_SELECTOR,
      new MDXSymbolProvider(),
      { label: EXTENSION_DISPLAY_NAME }
    )
  );

  // register completion provider (IntelliSense)
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      MDX_SELECTOR,
      new MDXCompletionProvider(),
      '<',
      ':',
      '!'
    )
  );

  // register outline tree view for preview panel
  outlineProvider = new MDXOutlineProvider();
  const treeView = vscode.window.createTreeView('mdxPreview.outline', {
    treeDataProvider: outlineProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  log.info('Language providers registered');
}
