// tests/shared/metadata-parity.test.ts
// verify mdx-forge metadata contracts match expected canonical values
// ! cross-repo parity; mirror in mdx-forge metadata contract test

import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

type CalloutModule = {
  CALLOUT_TITLES: Readonly<Record<string, string>>;
  CALLOUT_TYPE_ALIASES: Readonly<Record<string, string>>;
  VALID_CALLOUT_TYPES: ReadonlyArray<string>;
  normalizeCalloutType: (type: string | undefined) => string;
};

type IconsModule = {
  CALLOUT_ICONS: Readonly<Record<string, unknown>>;
  GITHUB_ICONS: Readonly<Record<string, unknown>>;
  GITHUB_ALERT_ICONS: Readonly<Record<string, unknown>>;
  FILE_TREE_ICONS: Readonly<Record<string, unknown>>;
  LUCIDE_ICONS: Readonly<Record<string, unknown>>;
};

const compilerModulePath = fileURLToPath(
  import.meta.resolve('mdx-forge/compiler')
);
const calloutModulePath = path.resolve(
  path.dirname(compilerModulePath),
  '../internal/callout.js'
);
const calloutModule = (await import(
  pathToFileURL(calloutModulePath).href
)) as CalloutModule;
const {
  CALLOUT_TITLES,
  CALLOUT_TYPE_ALIASES,
  VALID_CALLOUT_TYPES,
  normalizeCalloutType,
} = calloutModule;

const iconsModulePath = path.resolve(
  path.dirname(calloutModulePath),
  'icons.js'
);
const iconsModule = (await import(
  pathToFileURL(iconsModulePath).href
)) as IconsModule;
const {
  CALLOUT_ICONS,
  GITHUB_ICONS,
  GITHUB_ALERT_ICONS,
  FILE_TREE_ICONS,
  LUCIDE_ICONS,
} = iconsModule;

const EXPANDED_CONTRACT = {
  titles: {
    note: 'Note',
    tip: 'Tip',
    warning: 'Warning',
    danger: 'Danger',
    info: 'Info',
    caution: 'Caution',
    important: 'Important',
    summary: 'Summary',
    hint: 'Hint',
    success: 'Success',
    question: 'Question',
    failure: 'Failure',
    bug: 'Bug',
    example: 'Example',
    quote: 'Quote',
    todo: 'Todo',
    attention: 'Attention',
  },
  aliases: {
    abstract: 'summary',
    tldr: 'summary',
    check: 'success',
    done: 'success',
    help: 'question',
    faq: 'question',
    fail: 'failure',
    missing: 'failure',
    snippet: 'example',
    cite: 'quote',
    error: 'danger',
    warn: 'warning',
  },
};

const expectedContract = EXPANDED_CONTRACT;

describe('mdx-forge metadata contract', () => {
  describe('callout type contract', () => {
    it('CALLOUT_TITLES values match the supported display labels', () => {
      expect(CALLOUT_TITLES).toEqual(expectedContract.titles);
      expect([...VALID_CALLOUT_TYPES].sort()).toEqual(
        Object.keys(CALLOUT_TITLES).sort()
      );
      expect(VALID_CALLOUT_TYPES).toHaveLength(17);
    });
  });

  describe('callout alias contract', () => {
    it('aliases resolve to canonical types and unknown defaults to note', () => {
      expect(CALLOUT_TYPE_ALIASES).toEqual(expectedContract.aliases);
      for (const [alias, canonical] of Object.entries(
        expectedContract.aliases
      )) {
        expect(normalizeCalloutType(alias)).toBe(canonical);
      }
      expect(normalizeCalloutType('unknown')).toBe('note');
      expect(normalizeCalloutType(undefined)).toBe('note');
    });
  });

  describe('icon collection key contract', () => {
    it('icon collections expose the expected keys', () => {
      expect(Object.keys(CALLOUT_ICONS).sort()).toEqual(
        Object.keys(CALLOUT_TITLES).sort()
      );
      expect(Object.keys(GITHUB_ICONS).sort()).toEqual([
        'arrowRight',
        'check',
        'copy',
        'error',
        'important',
        'info',
        'lightbulb',
        'warning',
      ]);
      expect(Object.keys(GITHUB_ALERT_ICONS).sort()).toEqual([
        'CAUTION',
        'IMPORTANT',
        'NOTE',
        'TIP',
        'WARNING',
      ]);
      expect(Object.keys(FILE_TREE_ICONS).sort()).toEqual([
        'chevron',
        'file',
        'folder',
      ]);
      expect(Object.keys(LUCIDE_ICONS).sort()).toEqual([
        'arrowRight',
        'check',
        'copy',
      ]);
    });
  });
});
