// packages/extension/preview/PreviewEvaluator.ts
// orchestrates preview evaluation pipeline (document reading, MDX compilation, webview updates)

import * as vscode from 'vscode';
import * as fs from 'fs';
import { TextDecoder } from 'util';
import { debug } from '../logging';
import { LogTags } from '@mdx-preview/shared';
import evaluateInWebview from './evaluate-in-webview';
import type { WatcherManager, DocumentTracker } from './watchers';
import type { PreviewDocumentHandler } from './PreviewDocumentHandler';
import type {
  PreviewConfiguration,
  ConfigurationState,
} from './PreviewConfiguration';
import type { Preview } from './preview-manager';

// preview evaluator - orchestrates the evaluation pipeline
// handles document reading, version tracking, & calling evaluateInWebview
export class PreviewEvaluator {
  constructor(
    private preview: Preview,
    private documentHandler: PreviewDocumentHandler,
    private configManager: PreviewConfiguration,
    private watcherManager: WatcherManager
  ) {}

  // convenience accessors
  private get doc(): vscode.TextDocument {
    return this.documentHandler.doc;
  }

  private get text(): string {
    return this.documentHandler.text;
  }

  private get entryFsDirectory(): string | null {
    return this.documentHandler.entryFsDirectory;
  }

  private get configuration(): ConfigurationState {
    return this.configManager.configuration;
  }

  // update webview w/ current document content
  // - force: bypass version tracking (always re-render)
  // - handles different URI schemes: untitled, file, vscode-remote, etc.
  async updateWebview(force = false): Promise<void> {
    debug(`[${LogTags.PREVIEW_EVALUATOR}] updateWebview called`);
    const { uri } = this.doc;
    const { scheme, fsPath } = uri;
    debug(
      `[PREVIEW-EVALUATOR] updateWebview scheme=${scheme}, fsPath=${fsPath}`
    );

    const currentVersion = this.doc.version;
    const docTracker = this.watcherManager.get<DocumentTracker>('document');

    // skip if we've already rendered this version (unless forced)
    if (!force && docTracker?.hasRenderedVersion(currentVersion)) {
      debug(`[${LogTags.PREVIEW_EVALUATOR}] Skipping update - same version`);
      return;
    }

    switch (scheme) {
      case 'untitled': {
        debug(`[${LogTags.PREVIEW_EVALUATOR}] updateWebview: untitled scheme`);
        await evaluateInWebview(
          this.preview,
          this.text,
          this.entryFsDirectory ?? ''
        );
        break;
      }
      case 'file': {
        debug(`[${LogTags.PREVIEW_EVALUATOR}] updateWebview: file scheme`);
        if (this.configuration.updateMode === 'onType') {
          await evaluateInWebview(this.preview, this.text, fsPath);
        } else {
          // onSave or manual mode: read from disk
          const text = await fs.promises.readFile(fsPath, { encoding: 'utf8' });
          await evaluateInWebview(this.preview, text, fsPath);
        }
        break;
      }
      default: {
        // vscode-remote, vscode-vfs, etc.
        debug(`[PREVIEW-EVALUATOR] updateWebview: default scheme (${scheme})`);
        let text = this.text;
        if (this.configuration.updateMode !== 'onType') {
          try {
            const bytes = await vscode.workspace.fs.readFile(uri);
            text = new TextDecoder().decode(bytes);
          } catch {
            text = this.text;
          }
        }
        await evaluateInWebview(this.preview, text, fsPath);
        break;
      }
    }

    // update tracking after successful render
    docTracker?.markRendered(currentVersion);
  }
}
