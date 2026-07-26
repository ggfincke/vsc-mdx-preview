// packages/webview-client/src/shared/utils/clipboard.ts
// unified clipboard utility for both React & DOM contexts
// ! cross-repo duplicate; mirror changes in mdx-forge clipboard utility

import { CODE_COPY_FEEDBACK_DURATION_MS } from '../../app/constants';

// copy text to clipboard
// return true on success, false on failure
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// options for DOM-based copy w/ visual feedback
export interface CopyWithFeedbackOptions {
  // copied state class
  copiedClassName?: string;
  // feedback content
  copiedContent?: string;
  // restore content
  originalContent?: string;
  // duration ms
  duration?: number;
  // cancel pending feedback during owner cleanup
  signal?: AbortSignal;
}

const feedbackCleanups = new WeakMap<HTMLElement, () => void>();

// copy text & apply visual feedback to a DOM element
// used for DOM-based copy buttons (e.g., enhanceCodeBlocks)
export async function copyWithFeedback(
  text: string,
  element: HTMLElement,
  options: CopyWithFeedbackOptions = {}
): Promise<boolean> {
  const {
    copiedClassName = 'copied',
    copiedContent,
    originalContent,
    duration = CODE_COPY_FEEDBACK_DURATION_MS,
    signal,
  } = options;

  const success = await copyToClipboard(text);
  if (!success) {
    return false;
  }
  if (signal?.aborted || !element.isConnected) {
    return true;
  }

  feedbackCleanups.get(element)?.();

  // apply visual feedback
  element.classList.add(copiedClassName);

  const original = originalContent ?? element.innerHTML;
  if (copiedContent !== undefined) {
    element.innerHTML = copiedContent;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const cleanup = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    signal?.removeEventListener('abort', cleanup);
    if (feedbackCleanups.get(element) === cleanup) {
      feedbackCleanups.delete(element);
    }
    if (element.isConnected) {
      if (copiedContent !== undefined) {
        element.innerHTML = original;
      }
      element.classList.remove(copiedClassName);
    }
  };

  feedbackCleanups.set(element, cleanup);
  signal?.addEventListener('abort', cleanup, { once: true });
  timer = setTimeout(cleanup, duration);

  return true;
}
