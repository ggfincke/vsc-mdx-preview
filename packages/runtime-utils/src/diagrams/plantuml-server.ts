// packages/runtime-utils/src/diagrams/plantuml-server.ts
// normalize PlantUML server URLs & derive render endpoints

import { DEFAULT_PLANTUML_SERVER } from '@mdx-preview/contracts';

const DEFAULT_SERVER = new URL(DEFAULT_PLANTUML_SERVER);

// parse a user-provided server URL & enforce http/https only
function parseServerUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// remove trailing slashes to keep endpoint generation consistent
function trimTrailingSlashes(pathname: string): string {
  return pathname.replace(/\/+$/, '');
}

// normalize server URL for runtime use
function normalizePlantUmlServerUrl(
  input: string | null | undefined
): string {
  const parsed = typeof input === 'string' ? parseServerUrl(input) : null;
  const url = parsed ?? new URL(DEFAULT_SERVER.toString());

  const normalizedPath = trimTrailingSlashes(url.pathname);
  return normalizedPath
    ? `${url.protocol}//${url.host}${normalizedPath}`
    : `${url.protocol}//${url.host}`;
}

// add unique endpoint while preserving order
function pushUnique(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value);
  }
}

// build fallback endpoint list for Kroki & PlantUML-compatible servers
export function getPlantUmlRenderEndpoints(serverUrl: string): string[] {
  const normalized = normalizePlantUmlServerUrl(serverUrl);

  if (normalized.endsWith('/svg')) {
    return [normalized];
  }

  const endpoints: string[] = [];

  if (normalized.endsWith('/plantuml')) {
    pushUnique(endpoints, `${normalized}/svg`);
    const parsed = new URL(normalized);
    const fallbackBase =
      normalized.slice(0, -'/plantuml'.length) ||
      `${parsed.protocol}//${parsed.host}`;
    pushUnique(endpoints, `${fallbackBase}/svg`);
  } else {
    pushUnique(endpoints, `${normalized}/plantuml/svg`);
    pushUnique(endpoints, `${normalized}/svg`);
  }
  return endpoints;
}
