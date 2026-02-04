// packages/extension/prewarm/index.ts
// coordinate prewarming of heavy modules for improved first-render UX

import * as vscode from 'vscode';
import { LogTags } from '@mdx-preview/shared';
import { debug } from '../logging';
import { getTrustManager } from '../services';

let prewarmInitialized = false;

// initialize prewarm coordinator (call during extension activation)
export function initPrewarm(): vscode.Disposable {
  if (prewarmInitialized) {
    return { dispose: () => {} };
  }
  prewarmInitialized = true;

  const trustManager = getTrustManager();

  // check initial state & prewarm if already trusted
  const initialState = trustManager.getState();
  if (initialState.canExecute) {
    debug(`[${LogTags.PREWARM}] Trusted on init, starting prewarm`);
    void triggerBabelPrewarm();
  }

  // subscribe to trust state changes
  const subscription = trustManager.subscribe((state) => {
    if (state.canExecute) {
      debug(
        `[${LogTags.PREWARM}] Trust state changed to canExecute, starting prewarm`
      );
      void triggerBabelPrewarm();
    }
  });

  // prewarm when user opens an MDX file (anticipatory)
  const editorSubscription = vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (editor?.document.languageId === 'mdx') {
        const state = trustManager.getState();
        if (state.canExecute) {
          void triggerBabelPrewarm();
        }
      }
    }
  );

  return {
    dispose: () => {
      subscription.dispose();
      editorSubscription.dispose();
    },
  };
}

// trigger Babel prewarm (lazy import to avoid loading if not needed)
async function triggerBabelPrewarm(): Promise<void> {
  try {
    const { prewarmBabel } = await import('../module-system/transform/babel');
    await prewarmBabel();
  } catch (err) {
    debug(`[${LogTags.PREWARM}] Babel prewarm failed`, err);
  }
}
