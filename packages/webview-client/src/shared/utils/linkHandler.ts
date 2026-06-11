// packages/webview-client/src/shared/utils/linkHandler.ts
// link classification & handling utilities for webview

export type LinkType = 'anchor' | 'external' | 'relative-file' | 'unknown';

// allowed external URL schemes (opened via vscode.env.openExternal)
const EXTERNAL_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];

// file extensions that should open in editor
const DOCUMENT_EXTENSIONS = ['.md', '.mdx', '.html', '.htm'];

// classify a link by its type
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
    // invalid URL - fall through to the relative-path check below
  }

  // relative path w/o explicit scheme
  if (looksLikeRelativePath(href)) {
    return 'relative-file';
  }

  return 'unknown';
}

// check if a string looks like a relative file path
function looksLikeRelativePath(href: string): boolean {
  // start w/ ./ or ../
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
