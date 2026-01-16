// packages/extension/test/handlers/JsonHandler.test.ts
// tests for JsonHandler - wraps JSON content as CommonJS module

import { describe, it, expect } from 'vitest';
import { JsonHandler } from '../../module-fetcher/handlers/JsonHandler';
import type { Preview } from '../../preview/preview-manager';

describe('JsonHandler', () => {
  const handler = new JsonHandler();
  const mockPreview = {} as Preview;

  describe('extensions', () => {
    it('handles .json files', () => {
      expect(handler.extensions).toContain('.json');
    });

    it('only handles .json extension', () => {
      expect(handler.extensions).toHaveLength(1);
    });
  });

  describe('handle', () => {
    it('wraps valid JSON object in module.exports', async () => {
      const json = '{"name": "test", "value": 123}';
      const result = await handler.handle(
        json,
        '/path/to/file.json',
        mockPreview
      );

      expect(result.code).toBe(
        'module.exports = {"name": "test", "value": 123}'
      );
    });

    it('wraps valid JSON array in module.exports', async () => {
      const json = '[1, 2, 3, "four"]';
      const result = await handler.handle(
        json,
        '/path/to/array.json',
        mockPreview
      );

      expect(result.code).toBe('module.exports = [1, 2, 3, "four"]');
    });

    it('handles nested JSON structures', async () => {
      const json = '{"outer": {"inner": [1, 2, {"deep": true}]}}';
      const result = await handler.handle(
        json,
        '/path/to/nested.json',
        mockPreview
      );

      expect(result.code).toBe(
        'module.exports = {"outer": {"inner": [1, 2, {"deep": true}]}}'
      );
    });

    it('handles special characters and escape sequences', async () => {
      const json = '{"key": "value with \\"quotes\\" and \\n newline"}';
      const result = await handler.handle(
        json,
        '/path/to/special.json',
        mockPreview
      );

      expect(result.code).toContain('module.exports = ');
      expect(result.code).toContain('\\"quotes\\"');
    });

    it('handles empty object', async () => {
      const result = await handler.handle(
        '{}',
        '/path/to/empty.json',
        mockPreview
      );

      expect(result.code).toBe('module.exports = {}');
    });

    it('handles empty array', async () => {
      const result = await handler.handle(
        '[]',
        '/path/to/empty-array.json',
        mockPreview
      );

      expect(result.code).toBe('module.exports = []');
    });

    it('handles JSON with null values', async () => {
      const json = '{"value": null}';
      const result = await handler.handle(
        json,
        '/path/to/null.json',
        mockPreview
      );

      expect(result.code).toBe('module.exports = {"value": null}');
    });

    it('handles JSON with boolean values', async () => {
      const json = '{"enabled": true, "disabled": false}';
      const result = await handler.handle(
        json,
        '/path/to/bool.json',
        mockPreview
      );

      expect(result.code).toBe(
        'module.exports = {"enabled": true, "disabled": false}'
      );
    });

    it('returns empty dependencies array', async () => {
      const result = await handler.handle(
        '{}',
        '/path/to/file.json',
        mockPreview
      );

      expect(result.dependencies).toEqual([]);
    });

    it('preserves fsPath in result', async () => {
      const fsPath = '/workspace/config/settings.json';
      const result = await handler.handle('{}', fsPath, mockPreview);

      expect(result.fsPath).toBe(fsPath);
    });

    it('does not include css field in result', async () => {
      const result = await handler.handle(
        '{}',
        '/path/to/file.json',
        mockPreview
      );

      expect(result.css).toBeUndefined();
    });
  });
});
