// packages/extension/preview/StatusBarManager.ts
// * manage MDX Preview status bar item w/ trust state display

import * as vscode from 'vscode';
import { TrustManager, type TrustState } from '../security/TrustManager';
import { PreviewManager } from './preview-manager';

// * status bar manager singleton for MDX preview trust state display
export class StatusBarManager {
  private static instance: StatusBarManager | null = null;
  private statusBarItem: vscode.StatusBarItem;
  private disposables: vscode.Disposable[] = [];

  private constructor() {
    // create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'mdx-preview.commands.toggleScripts';

    // initial state
    this.updateDisplay(TrustManager.getInstance().getState());

    // subscribe to trust state changes
    this.disposables.push(
      TrustManager.getInstance().subscribe((state) => {
        this.updateDisplay(state);
      })
    );

    // subscribe to active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.updateVisibility();
      })
    );

    // subscribe to preview state changes
    this.disposables.push(
      PreviewManager.getInstance().subscribe(() => {
        this.updateVisibility();
      })
    );
  }

  // get singleton instance
  static getInstance(): StatusBarManager {
    if (!StatusBarManager.instance) {
      StatusBarManager.instance = new StatusBarManager();
    }
    return StatusBarManager.instance;
  }

  // static dispose for singleton cleanup
  static dispose(): void {
    if (StatusBarManager.instance) {
      StatusBarManager.instance.dispose();
      // @ts-expect-error reset singleton for dispose
      StatusBarManager.instance = undefined;
    }
  }

  // update status bar text & tooltip based on trust state
  private updateDisplay(trustState: TrustState): void {
    if (trustState.canExecute) {
      this.statusBarItem.text = '$(shield) MDX: Trusted';
      this.statusBarItem.tooltip =
        'MDX Preview is in Trusted Mode. JavaScript execution is enabled. Click to manage settings.';
      this.statusBarItem.backgroundColor = undefined;
    } else {
      this.statusBarItem.text = '$(shield) MDX: Safe';
      this.statusBarItem.tooltip = trustState.reason
        ? `MDX Preview is in Safe Mode: ${trustState.reason}. Click to manage settings.`
        : 'MDX Preview is in Safe Mode. JavaScript execution is disabled. Click to manage settings.';
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground'
      );
    }
  }

  // show/hide based on active editor language & preview state
  updateVisibility(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const languageId = editor.document.languageId;
      if (languageId === 'mdx' || languageId === 'markdown') {
        this.statusBarItem.show();
        return;
      }
    }

    // also show if there are any active previews
    const previewManager = PreviewManager.getInstance();
    if (previewManager.hasActivePreviews()) {
      this.statusBarItem.show();
    } else {
      this.statusBarItem.hide();
    }
  }

  // get disposable for extension subscriptions (the status bar item itself)
  getDisposable(): vscode.Disposable {
    return this.statusBarItem;
  }

  // dispose all resources
  private dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
    this.statusBarItem.dispose();
  }
}
