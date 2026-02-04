// packages/webview-app/src/utils/clipboard.ts
// unified clipboard utility for both React & DOM contexts

import { CODE_COPY_FEEDBACK_DURATION_MS } from '../constants';

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
}

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
  } = options;

  const success = await copyToClipboard(text);
  if (!success) {
    return false;
  }

  // apply visual feedback
  element.classList.add(copiedClassName);

  if (copiedContent !== undefined) {
    const original = originalContent ?? element.innerHTML;
    element.innerHTML = copiedContent;
    setTimeout(() => {
      element.innerHTML = original;
      element.classList.remove(copiedClassName);
    }, duration);
  } else {
    setTimeout(() => element.classList.remove(copiedClassName), duration);
  }

  return true;
}
