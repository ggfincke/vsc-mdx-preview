// packages/extension-host/src/features/themes/iconPackValidation.ts
// validate & narrow untrusted icon pack JSON to a safe, minimal Iconify shape

import type { IconifyIcon, IconifyIconPack } from '@mdx-preview/contracts';

// hard limits — packs come from workspace config & may be attacker-controlled
export const MAX_ICONS_PER_PACK = 10000;
export const MAX_BODY_LENGTH = 64 * 1024;

// ! best-effort host-side pre-filter; the webview's DOMPurify pass (allowlist)
// is the authoritative sanitizer. drops the obvious beacon/script vectors so
// they never reach the RPC payload, logs, or the webview. CSP blocks inline JS
// but img-src allows https:, so an <image>, external href, or a CSS url() (in a
// style attr or <style>) referencing an external/protocol-relative URL is a
// phone-home beacon. internal #fragment refs are allowed
const UNSAFE_BODY_RE =
  /<\s*(?:script|image|foreignobject|iframe|style)\b|javascript:|\son\w+\s*=|(?:(?:xlink:)?href\s*=|url\s*\()\s*["']?\s*(?!#)(?:[a-z][\w+.-]*:|\/\/)/i;

// reject oversized bodies & those carrying external-resource/script markup
export function isSafeIconBody(body: string): boolean {
  return body.length <= MAX_BODY_LENGTH && !UNSAFE_BODY_RE.test(body);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// validate & narrow untrusted JSON to the minimal Iconify shape
// drops unknown fields, oversized/dangerous bodies & prototype keys
// returns null if the result has no usable icons (pure & silent by design —
// a hostile pack with thousands of bad icons must not spam the log)
export function validateIconifyPack(raw: unknown): IconifyIconPack | null {
  if (!isPlainObject(raw) || !isPlainObject(raw.icons)) {
    return null;
  }
  const names = Object.keys(raw.icons);
  if (names.length === 0 || names.length > MAX_ICONS_PER_PACK) {
    return null;
  }

  const icons: Record<string, IconifyIcon> = {};
  for (const name of names) {
    if (
      name === '__proto__' ||
      name === 'constructor' ||
      name === 'prototype'
    ) {
      continue;
    }
    const entry = raw.icons[name];
    if (!isPlainObject(entry) || typeof entry.body !== 'string') {
      continue;
    }
    if (!isSafeIconBody(entry.body)) {
      continue;
    }
    const icon: IconifyIcon = { body: entry.body };
    for (const key of ['width', 'height', 'left', 'top', 'rotate'] as const) {
      if (typeof entry[key] === 'number') {
        icon[key] = entry[key] as number;
      }
    }
    for (const key of ['hFlip', 'vFlip'] as const) {
      if (typeof entry[key] === 'boolean') {
        icon[key] = entry[key] as boolean;
      }
    }
    icons[name] = icon;
  }
  if (Object.keys(icons).length === 0) {
    return null;
  }

  const pack: IconifyIconPack = { icons };
  if (typeof raw.prefix === 'string') pack.prefix = raw.prefix;
  if (typeof raw.width === 'number') pack.width = raw.width;
  if (typeof raw.height === 'number') pack.height = raw.height;
  return pack;
}
