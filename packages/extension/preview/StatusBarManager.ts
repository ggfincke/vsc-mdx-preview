// packages/extension/preview/StatusBarManager.ts
// * manage MDX Preview status bar items (trust state + framework display)

import * as vscode from 'vscode';
import type { TrustState } from '../security/TrustManager';
import {
  getTrustManager,
  getPreviewManager,
  getFrameworkDetector,
} from '../services';
import {
  STATUS_BAR_TRUST_PRIORITY,
  STATUS_BAR_FRAMEWORK_PRIORITY,
} from '../constants';

// * status bar manager singleton for MDX preview status display
export class StatusBarManager {
  private static instance: StatusBarManager | null = null;
  private trustStatusBarItem: vscode.StatusBarItem;
  private frameworkStatusBarItem: vscode.StatusBarItem;
  private disposables: vscode.Disposable[] = [];

  private constructor() {
    // create trust status bar item
    this.trustStatusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      STATUS_BAR_TRUST_PRIORITY
    );
    this.trustStatusBarItem.command = 'mdx-preview.commands.toggleScripts';

    // create framework status bar item (slightly lower priority than trust item)
    this.frameworkStatusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      STATUS_BAR_FRAMEWORK_PRIORITY
    );
    this.frameworkStatusBarItem.command =
      'mdx-preview.commands.selectFramework';

    // initial state
    this.updateTrustDisplay(getTrustManager().getState());
    this.updateFrameworkDisplay();

    // subscribe to trust state changes
    this.disposables.push(
      getTrustManager().subscribe((state) => {
        this.updateTrustDisplay(state);
      })
    );

    // subscribe to framework changes
    this.disposables.push(
      getFrameworkDetector().subscribe(() => {
        this.updateFrameworkDisplay();
      })
    );

    // subscribe to active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.updateVisibility();
        this.updateFrameworkDisplay();
      })
    );

    // subscribe to preview state changes
    this.disposables.push(
      getPreviewManager().subscribe(() => {
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

  // update trust status bar text & tooltip
  private updateTrustDisplay(trustState: TrustState): void {
    if (trustState.canExecute) {
      this.trustStatusBarItem.text = '$(shield) MDX: Trusted';
      this.trustStatusBarItem.tooltip =
        'MDX Preview is in Trusted Mode. JavaScript execution is enabled. Click to manage settings.';
      this.trustStatusBarItem.backgroundColor = undefined;
    } else {
      this.trustStatusBarItem.text = '$(shield) MDX: Safe';
      this.trustStatusBarItem.tooltip = trustState.reason
        ? `MDX Preview is in Safe Mode: ${trustState.reason}. Click to manage settings.`
        : 'MDX Preview is in Safe Mode. JavaScript execution is disabled. Click to manage settings.';
      this.trustStatusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground'
      );
    }
  }

  // update framework status bar display
  private updateFrameworkDisplay(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.frameworkStatusBarItem.hide();
      return;
    }

    const languageId = editor.document.languageId;
    if (languageId !== 'mdx' && languageId !== 'markdown') {
      this.frameworkStatusBarItem.hide();
      return;
    }

    const frameworkDetector = getFrameworkDetector();
    const info = frameworkDetector.getFramework(editor.document.uri);
    const displayName = frameworkDetector.getFrameworkDisplayName(
      info.framework
    );

    // use different icon based on framework
    let icon = '$(symbol-misc)';
    switch (info.framework) {
      case 'docusaurus':
        icon = '$(book)';
        break;
      case 'nextjs':
        icon = '$(server)';
        break;
      case 'astro-starlight':
        icon = '$(star)';
        break;
    }

    this.frameworkStatusBarItem.text = `${icon} ${displayName}`;
    this.frameworkStatusBarItem.tooltip = info.detected
      ? `Framework: ${displayName} (auto-detected). Click to change.`
      : `Framework: ${displayName} (manual). Click to change.`;
    this.frameworkStatusBarItem.show();
  }

  // show/hide based on active editor language & preview state
  updateVisibility(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const languageId = editor.document.languageId;
      if (languageId === 'mdx' || languageId === 'markdown') {
        this.trustStatusBarItem.show();
        this.frameworkStatusBarItem.show();
        return;
      }
    }

    // also show if there are any active previews
    const previewManager = getPreviewManager();
    if (previewManager.hasActivePreviews()) {
      this.trustStatusBarItem.show();
      // framework item only shows for active mdx/md files
    } else {
      this.trustStatusBarItem.hide();
      this.frameworkStatusBarItem.hide();
    }
  }

  // get disposables for extension subscriptions
  getDisposables(): vscode.Disposable[] {
    return [this.trustStatusBarItem, this.frameworkStatusBarItem];
  }

  // dispose all resources (public for IService interface)
  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
    this.trustStatusBarItem.dispose();
    this.frameworkStatusBarItem.dispose();
  }
}
