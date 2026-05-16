// tests/shared/metadata-parity.test.ts
// verify mdx-forge metadata contracts match expected canonical values
// ! cross-repo parity; mirror in mdx-forge metadata contract test

import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

type CalloutModule = {
  CALLOUT_TITLES: Readonly<Record<string, string>>;
  CALLOUT_TYPE_ALIASES: Readonly<Record<string, string>>;
  normalizeCalloutType: (type: string | undefined) => string;
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
const { CALLOUT_TITLES, CALLOUT_TYPE_ALIASES, normalizeCalloutType } =
  calloutModule;

const LEGACY_CONTRACT = {
  titles: {
    note: 'Note',
    tip: 'Tip',
    warning: 'Warning',
    danger: 'Danger',
    info: 'Info',
    caution: 'Caution',
    important: 'Important',
  },
  aliases: {
    success: 'tip',
    error: 'danger',
    warn: 'warning',
    hint: 'tip',
  },
};

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

const expectedContract =
  'summary' in CALLOUT_TITLES ? EXPANDED_CONTRACT : LEGACY_CONTRACT;

describe('mdx-forge metadata contract', () => {
  describe('callout type contract', () => {
    it('CALLOUT_TITLES values match the supported display labels', () => {
      expect(CALLOUT_TITLES).toEqual(expectedContract.titles);
    });
  });

  describe('callout alias contract', () => {
    it('CALLOUT_TYPE_ALIASES matches a supported alias map', () => {
      expect(CALLOUT_TYPE_ALIASES).toEqual(expectedContract.aliases);
    });

    it('normalizeCalloutType resolves each supported alias', () => {
      for (const [alias, canonical] of Object.entries(
        expectedContract.aliases
      )) {
        expect(normalizeCalloutType(alias)).toBe(canonical);
      }
    });

    it('unknown types default to note', () => {
      expect(normalizeCalloutType('unknown')).toBe('note');
      expect(normalizeCalloutType(undefined)).toBe('note');
    });
  });
});
