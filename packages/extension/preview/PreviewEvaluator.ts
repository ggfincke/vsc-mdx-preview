// packages/extension/preview/PreviewEvaluator.ts
// orchestrates preview evaluation pipeline (document reading, MDX compilation, webview updates)

import * as vscode from 'vscode';
import { TextDecoder } from 'util';
import { createTaggedLogger } from '../logging';
import { LogTags } from '@mdx-preview/shared';

// module-level tagged logger
const log = createTaggedLogger(LogTags.PREVIEW_EVALUATOR);
import evaluateInWebview from './evaluate-in-webview';
import type { WatcherManager, DocumentTracker } from './watchers';
import type { PreviewDocumentHandler } from './PreviewDocumentHandler';
import type {
  PreviewConfiguration,
  ConfigurationState,
} from './PreviewConfiguration';
import type { Preview } from './preview-manager';
import { readFileAsync } from '../utils/file-utils';

// preview evaluator - orchestrate evaluation pipeline
// handle document reading, version tracking, & calling evaluateInWebview
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

  // update webview w/ current document content (force bypasses version tracking)
  async updateWebview(force = false): Promise<void> {
    log.debug('updateWebview called');
    const { uri } = this.doc;
    const { scheme, fsPath } = uri;
    log.debug(`updateWebview scheme=${scheme}, fsPath=${fsPath}`);

    const currentVersion = this.doc.version;
    const docTracker = this.watcherManager.get<DocumentTracker>('document');

    // skip if we've already rendered this version (unless forced)
    if (!force && docTracker?.hasRenderedVersion(currentVersion)) {
      log.debug('Skipping update - same version');
      return;
    }

    switch (scheme) {
      case 'untitled': {
        log.debug('updateWebview: untitled scheme');
        await evaluateInWebview(
          this.preview,
          this.text,
          this.entryFsDirectory ?? ''
        );
        break;
      }
      case 'file': {
        log.debug('updateWebview: file scheme');
        if (this.configuration.updateMode === 'onType') {
          await evaluateInWebview(this.preview, this.text, fsPath);
        } else {
          // onSave or manual mode: read from disk
          let readError: unknown;
          const savedText = await readFileAsync(fsPath, 'utf8', {
            onError: (error) => {
              readError = error;
            },
          });

          if (savedText === null) {
            throw readError instanceof Error
              ? readError
              : new Error(`Failed to read file: ${fsPath}`);
          }
          await evaluateInWebview(this.preview, savedText, fsPath);
        }
        break;
      }
      default: {
        // vscode-remote, vscode-vfs, etc
        log.debug(`updateWebview: default scheme (${scheme})`);
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
