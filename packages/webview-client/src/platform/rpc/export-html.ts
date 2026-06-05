// packages/webview-client/src/platform/rpc/export-html.ts
// export rendered preview DOM as a standalone HTML document

import { EXTENSION_DISPLAY_NAME, LogTags } from '@mdx-preview/contracts';
import { PREVIEW_CONTENT_CLASS, PREVIEW_ROOT_CLASS } from '../../app/constants';
import { createTaggedLogger } from '../../shared/utils/createTaggedLogger';

const log = createTaggedLogger(LogTags.RPC_WEBVIEW);

const PREVIEW_ROOT_SELECTOR = `.${PREVIEW_ROOT_CLASS}`;
const PREVIEW_CONTENT_SELECTOR = `.${PREVIEW_CONTENT_CLASS}`;
const CUSTOM_PROPERTY_REGEX = /--[A-Za-z0-9_-]+/g;
const CSS_URL_REGEX =
  /url\(\s*(?:"([^"]+)"|'([^']+)'|([^'")\s][^'")]*)?)\s*\)/g;
const FETCH_TIMEOUT_MS = 10_000;

export async function createExportableHtml(): Promise<string> {
  const root = document.querySelector<HTMLElement>(PREVIEW_ROOT_SELECTOR);
  const content = root?.querySelector<HTMLElement>(PREVIEW_CONTENT_SELECTOR);
  if (!root || !content) {
    throw new Error('No rendered preview content is available to export.');
  }

  const exportRoot = root.cloneNode(false) as HTMLElement;
  const contentClone = content.cloneNode(true) as HTMLElement;
  exportRoot.appendChild(contentClone);
  removeRuntimeOnlyStyles(exportRoot);
  removeExecutableContent(exportRoot);

  // run image inlining & stylesheet collection in parallel
  // avoid serial fetch latency for remote-heavy documents
  const [, styleBlocks] = await Promise.all([
    inlineImages(contentClone),
    collectStyleBlocks(),
  ]);

  const cssVariables = collectCssVariables(styleBlocks);
  if (cssVariables) {
    styleBlocks.push(cssVariables);
  }

  return buildHtmlDocument({
    title: getExportTitle(contentClone),
    htmlClass: document.documentElement.className,
    bodyClass: document.body.className,
    styles: styleBlocks,
    content: exportRoot.outerHTML,
  });
}

// strip transient runtime-only inline styles from cloned root
// keep data attributes used by collected style blocks
function removeRuntimeOnlyStyles(root: HTMLElement): void {
  root.style.removeProperty('zoom');
  if (!root.getAttribute('style')?.trim()) {
    root.removeAttribute('style');
  }
}

function removeExecutableContent(root: HTMLElement): void {
  root.querySelectorAll('script').forEach((node) => node.remove());
  const elements = [
    root,
    ...Array.from(root.querySelectorAll<HTMLElement>('*')),
  ];

  for (const element of elements) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (name.startsWith('on') || value.startsWith('javascript:')) {
        element.removeAttribute(attribute.name);
      }
    }
  }
}

async function collectStyleBlocks(): Promise<string[]> {
  const nodes = Array.from(
    document.querySelectorAll<HTMLStyleElement | HTMLLinkElement>(
      'style, link[rel="stylesheet"]'
    )
  );

  const blocks = await Promise.all(
    nodes.map(async (node) => {
      const rawCss =
        node instanceof HTMLStyleElement
          ? node.textContent
          : await readStylesheet(node);
      if (!rawCss?.trim()) {
        return null;
      }
      const baseUrl =
        node instanceof HTMLLinkElement ? node.href : document.baseURI;
      return inlineCssUrls(rawCss, baseUrl);
    })
  );

  return blocks.filter((block): block is string => block !== null);
}

async function readStylesheet(link: HTMLLinkElement): Promise<string | null> {
  const sheetCss = readStylesheetRules(link.sheet);
  if (sheetCss) {
    return sheetCss;
  }

  const response = await fetchWithTimeout(link.href);
  if (!response || !response.ok) {
    if (!response) {
      log.warn(`Stylesheet fetch failed or timed out: ${link.href}`);
    }
    return null;
  }
  try {
    return await response.text();
  } catch {
    return null;
  }
}

function readStylesheetRules(sheet: CSSStyleSheet | null): string | null {
  if (!sheet) {
    return null;
  }

  try {
    return Array.from(sheet.cssRules)
      .map((rule) => rule.cssText)
      .join('\n');
  } catch {
    return null;
  }
}

function collectCssVariables(styleBlocks: string[]): string {
  const names = new Set<string>();
  for (const css of styleBlocks) {
    for (const match of css.matchAll(CUSTOM_PROPERTY_REGEX)) {
      names.add(match[0]);
    }
  }

  const rootStyle = getComputedStyle(document.documentElement);
  const bodyStyle = getComputedStyle(document.body);
  const declarations: string[] = [];
  for (const name of Array.from(names).sort()) {
    const value =
      rootStyle.getPropertyValue(name) || bodyStyle.getPropertyValue(name);
    if (value.trim()) {
      declarations.push(`  ${name}: ${value.trim()};`);
    }
  }

  if (declarations.length === 0) {
    return '';
  }

  return `:root {\n${declarations.join('\n')}\n}`;
}

async function inlineImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
  const sources = Array.from(
    root.querySelectorAll<HTMLSourceElement>('picture source[srcset]')
  );
  let failed = 0;

  await Promise.all([
    ...images.map(async (image) => {
      const src = image.getAttribute('src');
      if (!src || src.startsWith('data:')) {
        return;
      }

      const dataUri = await fetchAsDataUri(src, document.baseURI);
      if (!dataUri) {
        failed++;
        return;
      }

      image.setAttribute('src', dataUri);
      image.removeAttribute('srcset');
    }),
    // strip picture source candidates so exported files use data URI images
    ...sources.map(async (source) => {
      source.removeAttribute('srcset');
    }),
  ]);

  if (failed > 0) {
    log.warn(`Failed to inline ${failed} image(s) during export.`);
  }
}

async function inlineCssUrls(css: string, baseUrl: string): Promise<string> {
  const matches = Array.from(css.matchAll(CSS_URL_REGEX));
  if (matches.length === 0) {
    return css;
  }

  let failed = 0;
  const replacements = await Promise.all(
    matches.map(async (match) => {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      const rawUrl = match[1] ?? match[2] ?? match[3] ?? '';
      const trimmedUrl = rawUrl.trim();
      if (!shouldInlineUrl(trimmedUrl)) {
        return { start, end, value: match[0] };
      }

      const dataUri = await fetchAsDataUri(trimmedUrl, baseUrl);
      if (!dataUri) {
        failed++;
        return { start, end, value: match[0] };
      }
      return { start, end, value: `url("${dataUri}")` };
    })
  );

  if (failed > 0) {
    log.warn(`Failed to inline ${failed} CSS asset(s) during export.`);
  }

  let result = '';
  let cursor = 0;
  for (const replacement of replacements) {
    result += css.slice(cursor, replacement.start);
    result += replacement.value;
    cursor = replacement.end;
  }
  result += css.slice(cursor);
  return result;
}

function shouldInlineUrl(url: string): boolean {
  return (
    url.length > 0 &&
    !url.startsWith('data:') &&
    !url.startsWith('#') &&
    !url.startsWith('about:')
  );
}

async function fetchAsDataUri(
  src: string,
  baseUrl: string
): Promise<string | null> {
  let url: string;
  try {
    url = new URL(src, baseUrl).toString();
  } catch {
    return null;
  }
  const response = await fetchWithTimeout(url);
  if (!response || !response.ok) {
    return null;
  }
  try {
    const blob = await response.blob();
    return await blobToDataUri(blob);
  } catch {
    return null;
  }
}

// return null on timeout or network error
// let callers preserve partial export progress
async function fetchWithTimeout(url: string): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// encode manually for webview & vitest Blob compatibility
// chunk bytes to stay under String.fromCharCode arg limits
async function blobToDataUri(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunks: string[] = [];
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
  }

  const mimeType = blob.type || 'application/octet-stream';
  return `data:${mimeType};base64,${btoa(chunks.join(''))}`;
}

function getExportTitle(root: HTMLElement): string {
  const heading = root.querySelector('h1')?.textContent?.trim();
  return heading || document.title || EXTENSION_DISPLAY_NAME;
}

interface HtmlDocumentInput {
  title: string;
  htmlClass: string;
  bodyClass: string;
  styles: string[];
  content: string;
}

function buildHtmlDocument(input: HtmlDocumentInput): string {
  const styles = input.styles
    .map((css) => `<style>\n${escapeStyleText(css)}\n</style>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en" class="${escapeHtml(input.htmlClass)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(input.title)}</title>
${styles}
</head>
<body class="${escapeHtml(input.bodyClass)}">
${input.content}
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeStyleText(value: string): string {
  return value.replace(/<\/style/gi, '<\\/style');
}
