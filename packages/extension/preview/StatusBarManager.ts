// packages/extension/preview/StatusBarManager.ts
// Manage MDX Preview status bar items for trust state & framework display

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
import { SingletonService } from '../services/SingletonService';

// Status bar manager singleton for MDX preview status display
export class StatusBarManager extends SingletonService<StatusBarManager> {
  protected static override instance: StatusBarManager | undefined;
  protected readonly logTag = 'STATUS-BAR';

  private trustStatusBarItem: vscode.StatusBarItem;
  private frameworkStatusBarItem: vscode.StatusBarItem;

  protected constructor() {
    super();

    // Create trust status bar item
    this.trustStatusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      STATUS_BAR_TRUST_PRIORITY
    );
    this.trustStatusBarItem.command = 'mdx-preview.commands.toggleScripts';

    // Create framework status bar item (lower priority than trust item)
    this.frameworkStatusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      STATUS_BAR_FRAMEWORK_PRIORITY
    );
    this.frameworkStatusBarItem.command =
      'mdx-preview.commands.selectFramework';

    // Initialize status displays
    this.updateTrustDisplay(getTrustManager().getState());
    this.updateFrameworkDisplay();

    // Subscribe to trust state changes
    this.addDisposable(
      getTrustManager().subscribe((state) => {
        this.updateTrustDisplay(state);
      })
    );

    // Subscribe to framework changes
    this.addDisposable(
      getFrameworkDetector().subscribe(() => {
        this.updateFrameworkDisplay();
      })
    );

    // Subscribe to active editor changes
    this.addDisposable(
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.updateVisibility();
        this.updateFrameworkDisplay();
      })
    );

    // Subscribe to preview state changes
    this.addDisposable(
      getPreviewManager().subscribe(() => {
        this.updateVisibility();
      })
    );
  }

  // Update trust status bar text & tooltip
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

  // Update framework status bar display
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

    // Use different icon based on framework
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
      case 'nextra':
        icon = '$(notebook)';
        break;
    }

    this.frameworkStatusBarItem.text = `${icon} ${displayName}`;
    this.frameworkStatusBarItem.tooltip = info.detected
      ? `Framework: ${displayName} (auto-detected). Click to change.`
      : `Framework: ${displayName} (manual). Click to change.`;
    this.frameworkStatusBarItem.show();
  }

  // Show/hide status items based on active editor language & preview state
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

    // Show if there are active previews
    const previewManager = getPreviewManager();
    if (previewManager.hasActivePreviews()) {
      this.trustStatusBarItem.show();
      // Framework item only shows for active mdx/md files
    } else {
      this.trustStatusBarItem.hide();
      this.frameworkStatusBarItem.hide();
    }
  }

  // Get disposables for extension subscriptions
  getDisposables(): vscode.Disposable[] {
    return [this.trustStatusBarItem, this.frameworkStatusBarItem];
  }

  // Dispose status bar items on cleanup
  protected override onDispose(): void {
    this.trustStatusBarItem.dispose();
    this.frameworkStatusBarItem.dispose();
  }
}
