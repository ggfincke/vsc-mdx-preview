/**
 * Tests for babel.ts configuration
 *
 * These tests verify:
 * 1. Deprecated plugin-proposal-* plugins are NOT used (except export-default-from)
 * 2. Standard plugin-transform-* plugins ARE used
 * 3. Removed plugins are not present
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Babel configuration', () => {
  let babelConfigSource: string;

  beforeAll(() => {
    // Read the source file directly to check plugin references
    const babelTsPath = path.join(__dirname, '../transpiler/babel.ts');
    babelConfigSource = fs.readFileSync(babelTsPath, 'utf-8');
  });

  describe('deprecated plugin-proposal-* plugins', () => {
    it('does NOT reference @babel/plugin-proposal-class-properties', () => {
      expect(babelConfigSource).not.toContain(
        'plugin-proposal-class-properties'
      );
    });

    it('does NOT reference @babel/plugin-proposal-optional-chaining', () => {
      expect(babelConfigSource).not.toContain(
        'plugin-proposal-optional-chaining'
      );
    });

    it('does NOT reference @babel/plugin-proposal-nullish-coalescing-operator', () => {
      expect(babelConfigSource).not.toContain(
        'plugin-proposal-nullish-coalescing-operator'
      );
    });

    it('does NOT reference @babel/plugin-proposal-export-namespace-from', () => {
      expect(babelConfigSource).not.toContain(
        'plugin-proposal-export-namespace-from'
      );
    });

    it('DOES keep @babel/plugin-proposal-export-default-from (Stage-1, intentionally kept)', () => {
      // This is a Stage-1 proposal that we intentionally keep for compatibility
      expect(babelConfigSource).toContain(
        'plugin-proposal-export-default-from'
      );
    });
  });

  describe('standard plugin-transform-* plugins', () => {
    it('uses @babel/plugin-transform-class-properties', () => {
      expect(babelConfigSource).toContain('plugin-transform-class-properties');
    });

    it('uses @babel/plugin-transform-optional-chaining', () => {
      expect(babelConfigSource).toContain('plugin-transform-optional-chaining');
    });

    it('uses @babel/plugin-transform-nullish-coalescing-operator', () => {
      expect(babelConfigSource).toContain(
        'plugin-transform-nullish-coalescing-operator'
      );
    });

    it('uses @babel/plugin-transform-export-namespace-from', () => {
      expect(babelConfigSource).toContain(
        'plugin-transform-export-namespace-from'
      );
    });
  });

  describe('removed plugins', () => {
    it('does NOT reference @babel/plugin-syntax-dynamic-import', () => {
      // This is handled by @babel/preset-env
      expect(babelConfigSource).not.toContain('plugin-syntax-dynamic-import');
    });

    it('does NOT reference babel-plugin-transform-dynamic-import', () => {
      // This was a non-standard plugin, now handled by preset-env
      expect(babelConfigSource).not.toContain(
        'babel-plugin-transform-dynamic-import'
      );
    });
  });

  describe('presets', () => {
    it('uses @babel/preset-env', () => {
      expect(babelConfigSource).toContain('@babel/preset-env');
    });

    it('uses @babel/preset-react', () => {
      expect(babelConfigSource).toContain('@babel/preset-react');
    });
  });
});
