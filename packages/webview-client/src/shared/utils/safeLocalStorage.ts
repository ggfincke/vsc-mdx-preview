// packages/webview-client/src/shared/utils/safeLocalStorage.ts
// localStorage wrappers that never throw in restricted webview contexts

// read a key, returning null on any failure
export function getItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

// write a key, swallowing any failure
export function setItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage failures
  }
}

// remove a key, swallowing any failure
export function removeItem(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore storage failures
  }
}
