// packages/extension/preview/PreviewState.ts
// state holder for preview evaluation results & Tailwind request tracking

import {
  PerformanceObserver,
  PerformanceObserverEntryList,
  performance,
} from 'perf_hooks';
import * as vscode from 'vscode';

// preview state - holds evaluation state & tracks Tailwind requests
// extracted from Preview class to simplify state management
export class PreviewState {
  // Tailwind request ID counter (ensures stale Tailwind responses are ignored)
  private tailwindRequestId = 0;

  // performance tracking (development only)
  private _performanceObserver?: PerformanceObserver;
  private _evaluationDuration = 0;
  private _previewDuration = 0;

  // get next Tailwind request ID (incremented for each new Tailwind compilation)
  nextTailwindRequestId(): number {
    this.tailwindRequestId += 1;
    return this.tailwindRequestId;
  }

  // check if Tailwind request ID is still current (not superseded by newer request)
  isTailwindRequestCurrent(requestId: number): boolean {
    return requestId === this.tailwindRequestId;
  }

  // performance accessors
  get performanceObserver(): PerformanceObserver | undefined {
    return this._performanceObserver;
  }

  get evaluationDuration(): number {
    return this._evaluationDuration;
  }

  set evaluationDuration(value: number) {
    this._evaluationDuration = value;
  }

  get previewDuration(): number {
    return this._previewDuration;
  }

  // setup performance observer (development only)
  // displays timing info after preview updates
  setupPerformanceObserver(): void {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    this._performanceObserver = new PerformanceObserver(
      (list: PerformanceObserverEntryList) => {
        this._previewDuration = list.getEntries()[0].duration;
        vscode.window.showInformationMessage(
          `Previewing used: ${Number(this._previewDuration / 1000).toFixed(2)} seconds. ` +
            `Evaluation used: ${Number(this._evaluationDuration / 1000).toFixed(2)} seconds.`
        );
        performance.clearMarks();
      }
    );
    this._performanceObserver.observe({ entryTypes: ['measure'] });
  }

  // cleanup performance observer
  dispose(): void {
    this._performanceObserver?.disconnect();
    this._performanceObserver = undefined;
  }
}
