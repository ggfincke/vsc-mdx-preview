// packages/extension/utils/disposable.ts
// Utility functions for disposing VS Code disposables from collections

import type { Disposable } from 'vscode';

// dispose all items from a collection (Array or Map) & clear it
export function disposeCollection(
  collection: Disposable[] | Map<string, Disposable>
): void {
  if (Array.isArray(collection)) {
    for (const item of collection) {
      item.dispose();
    }
    collection.length = 0;
  } else {
    for (const item of collection.values()) {
      item.dispose();
    }
    collection.clear();
  }
}

// dispose a single disposable if it exists (safe to call w/ undefined)
export function disposeOne(disposable: Disposable | undefined): void {
  disposable?.dispose();
}
