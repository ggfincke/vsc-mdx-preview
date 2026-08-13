// packages/webview-client/src/shared/utils/linkHandler.ts
// link classification & handling utilities for webview

export type LinkType = 'anchor' | 'external' | 'relative-file' | 'unknown';

const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

// file extensions that should open in editor
const DOCUMENT_EXTENSIONS = ['.md', '.mdx', '.html', '.htm'];

// classify a link by its type
export function classifyLink(href: string): LinkType {
  const value = href.trim();
  if (!value || hasAsciiControl(href)) {
    return 'unknown';
  }

  // anchor links start w/ #
  if (value.startsWith('#')) {
    return 'anchor';
  }

  // protocol-relative links need an HTTP scheme before crossing the host RPC
  if (value.startsWith('//')) {
    return parseProtocolRelativeUrl(value) ? 'external' : 'unknown';
  }

  if (looksLikeRelativePath(value)) {
    return getRelativeFilePath(value) ? 'relative-file' : 'unknown';
  }

  if (normalizeExternalHref(value)) {
    return 'external';
  }

  // parse only explicit URLs so arbitrary prose does not become a file path
  try {
    const url = new URL(value);

    // file: scheme or relative path
    if (url.protocol === 'file:') {
      return getRelativeFilePath(value) ? 'relative-file' : 'unknown';
    }
  } catch {
    // invalid explicit URLs are not workspace paths
    return 'unknown';
  }

  return 'unknown';
}

// convert external syntax into a URL accepted by the extension host
export function normalizeExternalHref(href: string): string | undefined {
  if (hasAsciiControl(href)) {
    return undefined;
  }
  const value = href.trim();
  const url = value.startsWith('//')
    ? parseProtocolRelativeUrl(value)
    : parseExternalUrl(value);
  return url?.href.replace(/ /g, '%20');
}

// convert relative-file syntax into the filesystem path expected by host RPC
export function getRelativeFilePath(href: string): string | undefined {
  const value = href.trim();
  if (/^file:/i.test(value)) {
    try {
      const url = new URL(value);
      if (/%(?:2f|5c)/i.test(url.pathname)) {
        return undefined;
      }
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.includes('\0')) {
        return undefined;
      }
      if (url.hostname && url.hostname !== 'localhost') {
        pathname = `//${url.hostname}${pathname}`;
      } else if (/^\/[a-z]:[\\/]/i.test(pathname)) {
        pathname = pathname.slice(1);
      }
      return pathname || undefined;
    } catch {
      return undefined;
    }
  }

  const pathname = value.split(/[?#]/, 1)[0];
  if (!pathname || /%(?:2f|5c)/i.test(pathname)) {
    return undefined;
  }
  try {
    const decoded = decodeURIComponent(pathname);
    return decoded.includes('\0') ? undefined : decoded;
  } catch {
    return undefined;
  }
}

// parse host-safe external forms & keep their canonical representation
function parseExternalUrl(href: string): URL | undefined {
  try {
    const url = new URL(href);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return /^https?:\/\/[^/\\\s?#]/i.test(href) &&
        !hasHierarchicalBackslash(href) &&
        url.hostname
        ? url
        : undefined;
    }
    return url.protocol === 'mailto:' || url.protocol === 'tel:'
      ? url
      : undefined;
  } catch {
    return undefined;
  }
}

// parse network-path references without letting URL repair extra leading slashes
function parseProtocolRelativeUrl(href: string): URL | undefined {
  if (!/^\/\/[^/\\\s?#]/.test(href) || hasHierarchicalBackslash(href)) {
    return undefined;
  }
  try {
    const url = new URL(`https:${href}`);
    return url.hostname ? url : undefined;
  } catch {
    return undefined;
  }
}

// special URLs must not rely on backslash-to-slash parser repair
function hasHierarchicalBackslash(value: string): boolean {
  return value.split(/[?#]/, 1)[0].includes('\\');
}

// reject characters the URL parser would silently trim or remove
function hasAsciiControl(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

// check if a string looks like a relative file path
function looksLikeRelativePath(href: string): boolean {
  if (
    href.startsWith('/') ||
    href.startsWith('\\') ||
    href.startsWith('./') ||
    href.startsWith('../') ||
    /^[a-z]:[\\/]/i.test(href)
  ) {
    return true;
  }

  if (URL_SCHEME_PATTERN.test(href)) {
    return false;
  }

  const path = href.split(/[?#]/, 1)[0].toLowerCase();
  return DOCUMENT_EXTENSIONS.some((ext) => path.endsWith(ext));
}
