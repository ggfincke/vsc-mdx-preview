// packages/webview-app/src/utils/linkHandler.ts
// link classification & handling utilities for webview

export type LinkType = 'anchor' | 'external' | 'relative-file' | 'unknown';

// allowed external URL schemes (opened via vscode.env.openExternal)
const EXTERNAL_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];

// file extensions that should open in editor
const DOCUMENT_EXTENSIONS = ['.md', '.mdx', '.html', '.htm'];

/**
 * Classify a link by its type.
 */
export function classifyLink(href: string): LinkType {
  if (!href || href.trim() === '') {
    return 'unknown';
  }

  // anchor links start w/ #
  if (href.startsWith('#')) {
    return 'anchor';
  }

  // try to parse as URL
  try {
    // use a dummy base for relative URLs
    const url = new URL(href, 'file:///dummy/');

    // check for external schemes
    if (EXTERNAL_SCHEMES.includes(url.protocol)) {
      return 'external';
    }

    // file: scheme or relative path
    if (url.protocol === 'file:') {
      return 'relative-file';
    }
  } catch {
    // invalid URL - treat as relative path if it looks like a file
    if (looksLikeRelativePath(href)) {
      return 'relative-file';
    }
  }

  // relative path w/o explicit scheme
  if (looksLikeRelativePath(href)) {
    return 'relative-file';
  }

  return 'unknown';
}

/**
 * Check if a string looks like a relative file path.
 */
function looksLikeRelativePath(href: string): boolean {
  // starts w/ ./ or ../
  if (href.startsWith('./') || href.startsWith('../')) {
    return true;
  }

  // doesn't contain :// (not a URL) & has file-like extension
  if (!href.includes('://')) {
    const hasDocExt = DOCUMENT_EXTENSIONS.some((ext) =>
      href.toLowerCase().endsWith(ext)
    );
    if (hasDocExt) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a URL has an allowed external scheme.
 */
export function isAllowedExternalScheme(url: string): boolean {
  try {
    const parsed = new URL(url);
    return EXTERNAL_SCHEMES.includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Normalize a relative path for file opening.
 * Removes fragments & query strings.
 */
export function normalizeRelativePath(href: string): string {
  // remove fragment
  const withoutFragment = href.split('#')[0];
  // remove query string
  const withoutQuery = withoutFragment.split('?')[0];
  return withoutQuery;
}

/**
 * Extract anchor/fragment from a link.
 */
export function extractAnchor(href: string): string | null {
  const hashIndex = href.indexOf('#');
  if (hashIndex === -1) {
    return null;
  }
  return href.slice(hashIndex + 1);
}
