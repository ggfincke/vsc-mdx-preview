// packages/registry/src/callout/index.ts
// shared callout type definitions & normalization
// single source of truth for callout types across extension & webview

// canonical callout types supported by extension - map to semantic meaning & styling
export type CalloutType =
  | 'note'
  | 'tip'
  | 'warning'
  | 'danger'
  | 'info'
  | 'caution'
  | 'important';

// valid callout types
export const VALID_CALLOUT_TYPES: readonly CalloutType[] = [
  'note',
  'tip',
  'warning',
  'danger',
  'info',
  'caution',
  'important',
] as const;

// callout types set
export const VALID_CALLOUT_TYPE_SET: ReadonlySet<string> = new Set(
  VALID_CALLOUT_TYPES
);

// aliases that map to canonical callout types - common variations used by different documentation frameworks
export const CALLOUT_TYPE_ALIASES: Readonly<Record<string, CalloutType>> = {
  success: 'tip',
  error: 'danger',
  warn: 'warning',
  hint: 'tip',
} as const;

// default display titles for each callout type - used when no custom title provided
export const CALLOUT_TITLES: Readonly<Record<CalloutType, string>> = {
  note: 'Note',
  tip: 'Tip',
  warning: 'Warning',
  danger: 'Danger',
  info: 'Info',
  caution: 'Caution',
  important: 'Important',
} as const;

// normalize callout type string to canonical CalloutType
// handle aliases (success -> tip, error -> danger, etc.) & case-insensitivity
// return 'note' for undefined or unknown types
export function normalizeCalloutType(type: string | undefined): CalloutType {
  if (!type) {
    return 'note';
  }

  const normalized = type.toLowerCase();

  // check aliases first
  if (normalized in CALLOUT_TYPE_ALIASES) {
    return CALLOUT_TYPE_ALIASES[normalized];
  }

  // check valid types
  if (VALID_CALLOUT_TYPE_SET.has(normalized)) {
    return normalized as CalloutType;
  }

  // fallback to 'note' for unknown types
  return 'note';
}

// check if string is valid callout type (including aliases)
export function isValidCalloutType(type: string): boolean {
  const normalized = type.toLowerCase();
  return (
    VALID_CALLOUT_TYPE_SET.has(normalized) || normalized in CALLOUT_TYPE_ALIASES
  );
}
