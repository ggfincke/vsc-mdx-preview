// packages/webview-client/src/features/preview/shared/utils/sourceLineElements.ts
// source-line DOM mapping helpers for preview interaction

export const HIGHLIGHT_LINE_CLASS = 'highlight-line';
export const HIGHLIGHT_ACTIVE_CLASS = 'highlight-active';

export const SOURCE_LINE_SELECTOR = '[data-source-line]';
const CALLOUT_OWNER_SELECTOR = [
  '.mdx-safe-callout',
  '.mdx-preview-admonition',
  '.github-alert',
  '[data-callout-type]',
  '.mdx-preview-nextra-callout',
  '.mdx-preview-nextra-callout-wrapper',
].join(', ');
const TRUSTED_SHIM_OWNER_SELECTOR = [
  '[data-callout-type]',
  '[data-component="collapsible"]',
  '[data-component="tabs"]',
  '.mdx-preview-generic-code-group',
].join(', ');

export interface SourceLineEntry {
  highlightElement: Element;
  sourceLine: number | null;
}

export function getDataSourceLine(element: Element): number | null {
  const dataLine = element.getAttribute('data-source-line');
  if (!dataLine) {
    return null;
  }
  const line = Number.parseInt(dataLine, 10);
  return Number.isFinite(line) ? line : null;
}

function getFirstSourceLine(element: Element): number | null {
  const ownLine = getDataSourceLine(element);
  if (ownLine !== null) {
    return ownLine;
  }

  const child = element.querySelector(SOURCE_LINE_SELECTOR);
  return child ? getDataSourceLine(child) : null;
}

function resolveCalloutOwner(
  sourceLineElement: Element,
  root: HTMLElement
): Element | null {
  const calloutOwner = sourceLineElement.closest(CALLOUT_OWNER_SELECTOR);
  if (!calloutOwner || !root.contains(calloutOwner)) {
    return null;
  }

  if (calloutOwner.classList.contains('mdx-preview-nextra-callout-wrapper')) {
    const promotedOwner = Array.from(calloutOwner.children).find((child) =>
      child.classList.contains('mdx-preview-nextra-callout')
    );
    if (promotedOwner && root.contains(promotedOwner)) {
      return promotedOwner;
    }
  }

  return calloutOwner;
}

export function resolveHighlightOwner(
  sourceLineElement: Element,
  root: HTMLElement
): Element | null {
  const table = sourceLineElement.closest('table');
  if (table && root.contains(table)) {
    return table;
  }

  const calloutOwner = resolveCalloutOwner(sourceLineElement, root);
  if (calloutOwner) {
    return calloutOwner;
  }

  const listItem = sourceLineElement.closest('li');
  if (listItem && root.contains(listItem)) {
    return listItem;
  }

  if (sourceLineElement.tagName === 'IMG') {
    return sourceLineElement.parentElement ?? sourceLineElement;
  }

  if (sourceLineElement.parentElement?.tagName === 'P') {
    return sourceLineElement.parentElement;
  }

  return sourceLineElement;
}

export function collectSourceLineEntries(
  container: HTMLElement
): SourceLineEntry[] {
  const sourceLineElements = Array.from(
    container.querySelectorAll(SOURCE_LINE_SELECTOR)
  );
  const seenHighlightElements = new Set<Element>();
  const entries: SourceLineEntry[] = [];

  const registerHighlightElement = (
    highlightElement: Element,
    sourceLine: number | null
  ): void => {
    if (seenHighlightElements.has(highlightElement)) {
      return;
    }

    seenHighlightElements.add(highlightElement);
    entries.push({ highlightElement, sourceLine });
  };

  sourceLineElements.forEach((sourceLineElement) => {
    if (sourceLineElement.tagName === 'A') {
      return;
    }

    const dataSourceLine = getDataSourceLine(sourceLineElement);
    if (dataSourceLine === null) {
      return;
    }

    const highlightElement = resolveHighlightOwner(
      sourceLineElement,
      container
    );
    if (!highlightElement) {
      return;
    }

    registerHighlightElement(highlightElement, dataSourceLine);
  });

  const trustedShimOwners = Array.from(
    container.querySelectorAll(TRUSTED_SHIM_OWNER_SELECTOR)
  );
  trustedShimOwners.forEach((owner) => {
    registerHighlightElement(owner, getFirstSourceLine(owner));
  });

  Array.from(container.children).forEach((child) => {
    if (child.hasAttribute('data-source-line')) {
      return;
    }

    if (child.querySelector(SOURCE_LINE_SELECTOR)) {
      return;
    }

    registerHighlightElement(child, null);
  });

  return entries;
}
