// packages/webview-app/src/utils/clipboard.ts
// Unified clipboard utility for both React & DOM contexts

import { CODE_COPY_FEEDBACK_DURATION_MS } from '../constants';

// copy text to clipboard
// returns true on success, false on failure
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
  // class to add when copied (default: 'copied')
  copiedClassName?: string;
  // HTML content to show when copied
  copiedContent?: string;
  // HTML content to restore after feedback (default: original innerHTML)
  originalContent?: string;
  // feedback duration in ms (default: CODE_COPY_FEEDBACK_DURATION_MS)
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
  if (!success) {return false;}

  // Apply visual feedback
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
