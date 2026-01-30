// tests/shared/logging-types.test.ts
// tests for shared logging type definitions

import { describe, it, expect } from 'vitest';
import { LogLevel } from '@mdx-preview/shared';

describe('shared logging types', () => {
  describe('LogLevel enum', () => {
    it('exports all expected log levels', () => {
      expect(LogLevel.Debug).toBe('DEBUG');
      expect(LogLevel.Info).toBe('INFO');
      expect(LogLevel.Warn).toBe('WARN');
      expect(LogLevel.Error).toBe('ERROR');
    });

    it('has exactly 4 levels', () => {
      const levels = Object.values(LogLevel);
      expect(levels).toHaveLength(4);
    });
  });
});
