// shared callout type definitions & normalization

export type CalloutType =
  | 'note'
  | 'tip'
  | 'warning'
  | 'danger'
  | 'info'
  | 'caution'
  | 'important';

export const VALID_CALLOUT_TYPES: readonly CalloutType[] = [
  'note',
  'tip',
  'warning',
  'danger',
  'info',
  'caution',
  'important',
] as const;

export const VALID_CALLOUT_TYPE_SET: ReadonlySet<string> = new Set(
  VALID_CALLOUT_TYPES
);

export const CALLOUT_TYPE_ALIASES: Readonly<Record<string, CalloutType>> = {
  success: 'tip',
  error: 'danger',
  warn: 'warning',
  hint: 'tip',
} as const;

export const CALLOUT_TITLES: Readonly<Record<CalloutType, string>> = {
  note: 'Note',
  tip: 'Tip',
  warning: 'Warning',
  danger: 'Danger',
  info: 'Info',
  caution: 'Caution',
  important: 'Important',
} as const;

export function normalizeCalloutType(type: string | undefined): CalloutType {
  if (!type) {
    return 'note';
  }

  const normalized = type.toLowerCase();
  if (normalized in CALLOUT_TYPE_ALIASES) {
    return CALLOUT_TYPE_ALIASES[normalized];
  }

  if (VALID_CALLOUT_TYPE_SET.has(normalized)) {
    return normalized as CalloutType;
  }

  return 'note';
}

export function isValidCalloutType(type: string): boolean {
  const normalized = type.toLowerCase();
  return (
    VALID_CALLOUT_TYPE_SET.has(normalized) || normalized in CALLOUT_TYPE_ALIASES
  );
}
