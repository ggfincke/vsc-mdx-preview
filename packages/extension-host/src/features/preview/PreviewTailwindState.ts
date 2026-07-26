// packages/extension-host/src/features/preview/PreviewTailwindState.ts
// Tailwind request tracking & browser runtime state for a preview instance

// track Tailwind CSS request IDs & browser runtime state
export class PreviewTailwindState {
  private requestId = 0;
  private browserRuntimeEnabled = false;
  private fallbackReason: string | null = null;

  // increment & return next request ID (stale response detection)
  nextRequestId(): number {
    this.requestId += 1;
    return this.requestId;
  }

  // check if a request ID is still current (not stale)
  isRequestCurrent(id: number): boolean {
    return id === this.requestId;
  }

  // set browser runtime enabled state, return true if changed
  setBrowserRuntimeEnabled(enabled: boolean): boolean {
    if (this.browserRuntimeEnabled === enabled) {
      return false;
    }
    this.browserRuntimeEnabled = enabled;
    return true;
  }

  // check if browser runtime is enabled
  isBrowserRuntimeEnabled(): boolean {
    return this.browserRuntimeEnabled;
  }

  // mark a fallback reason, return true if changed
  markFallbackReason(reason: string): boolean {
    if (this.fallbackReason === reason) {
      return false;
    }
    this.fallbackReason = reason;
    return true;
  }

  // clear the fallback reason
  clearFallbackReason(): void {
    this.fallbackReason = null;
  }

  resetForDocument(): void {
    this.requestId += 1;
    this.browserRuntimeEnabled = false;
    this.fallbackReason = null;
  }
}
