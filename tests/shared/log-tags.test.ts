// tests/shared/log-tags.test.ts
// tests for centralized log tag registry

import { describe, it, expect } from 'vitest';
import { LogTags, type LogTag } from '@mdx-preview/shared';

describe('LogTags registry', () => {
  it('should use UPPERCASE-KEBAB format for all tag values', () => {
    const tagValues = Object.values(LogTags);
    for (const tag of tagValues) {
      expect(tag).toMatch(/^[A-Z][A-Z0-9-]*$/);
    }
  });

  it('should not have duplicate tag values', () => {
    const tagValues = Object.values(LogTags);
    const uniqueValues = new Set(tagValues);
    expect(uniqueValues.size).toBe(tagValues.length);
  });

  it('should export expected RPC tags', () => {
    expect(LogTags.RPC_EXT).toBe('RPC-EXT');
    expect(LogTags.RPC_WEBVIEW).toBe('RPC-WEBVIEW');
    expect(LogTags.EXT_HANDLE).toBe('EXT-HANDLE');
  });

  it('should export expected preview system tags', () => {
    expect(LogTags.PREVIEW).toBe('PREVIEW');
    expect(LogTags.PREVIEW_MANAGER).toBe('PREVIEW-MANAGER');
    expect(LogTags.PREVIEW_EVALUATOR).toBe('PREVIEW-EVALUATOR');
    expect(LogTags.PREVIEW_CONTEXT).toBe('PREVIEW-CONTEXT');
    expect(LogTags.ENGINE).toBe('ENGINE');
    expect(LogTags.WEBVIEW_MGR).toBe('WEBVIEW-MGR');
  });

  it('should export expected module system tags', () => {
    expect(LogTags.UNIFIED_RESOLVER).toBe('UNIFIED-RESOLVER');
    expect(LogTags.RESOLVER).toBe('RESOLVER');
    expect(LogTags.MODULE_SYSTEM).toBe('MODULE-SYSTEM');
    expect(LogTags.IMPORT_EXTRACTOR).toBe('IMPORT-EXTRACTOR');
  });

  it('should export expected webview tags', () => {
    expect(LogTags.APP).toBe('APP');
    expect(LogTags.WEBVIEW).toBe('WEBVIEW');
    expect(LogTags.WEBVIEW_STATE).toBe('WEBVIEW-STATE');
    expect(LogTags.PRELOAD).toBe('PRELOAD');
    expect(LogTags.SHIM_LOADER).toBe('SHIM-LOADER');
  });

  it('should export expected context tags', () => {
    expect(LogTags.ZOOM_CONTEXT).toBe('ZOOM-CONTEXT');
    expect(LogTags.LOADING_CONTEXT).toBe('LOADING-CONTEXT');
    expect(LogTags.TRUST_CONTEXT).toBe('TRUST-CONTEXT');
    expect(LogTags.NEXTRA_CONTEXT).toBe('NEXTRA-CONTEXT');
  });

  it('should have consistent naming (UPPERCASE with hyphens)', () => {
    // verify no PascalCase tags (the old inconsistent format)
    const tagValues = Object.values(LogTags);
    for (const tag of tagValues) {
      // should not have lowercase letters
      expect(tag).not.toMatch(/[a-z]/);
      // should not have underscores (use hyphens instead)
      expect(tag).not.toContain('_');
    }
  });

  describe('type safety', () => {
    it('should allow LogTag type assignment from LogTags values', () => {
      // compile-time check - if this compiles, the type is correct
      const tag: LogTag = LogTags.PREVIEW;
      expect(tag).toBe('PREVIEW');
    });

    it('should have all keys as valid constants', () => {
      // verify all keys are uppercase with underscores
      const tagKeys = Object.keys(LogTags);
      for (const key of tagKeys) {
        expect(key).toMatch(/^[A-Z][A-Z0-9_]*$/);
      }
    });
  });
});
