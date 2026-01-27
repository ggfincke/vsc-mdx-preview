// packages/extension/utils/validation/url.ts
// URL validation utilities

import {
  formatContext,
  getLogger,
  type ValidationOptions,
} from '../validation-factory';
import { validateString } from './primitives';

// validates & parses a URL string
export function validateUrl(
  value: unknown,
  name: string,
  opts?: ValidationOptions & { allowedSchemes?: string[] }
): URL | undefined {
  const str = validateString(value, name, opts);
  if (str === undefined) {
    return undefined;
  }

  const log = getLogger(opts);
  const ctx = formatContext(opts?.context);

  let parsed: URL;
  try {
    parsed = new URL(str);
  } catch {
    log(`${ctx}failed to parse ${name}`, str);
    return undefined;
  }

  if (opts?.allowedSchemes && !opts.allowedSchemes.includes(parsed.protocol)) {
    log(`${ctx}disallowed scheme for ${name}`, parsed.protocol);
    return undefined;
  }

  return parsed;
}
