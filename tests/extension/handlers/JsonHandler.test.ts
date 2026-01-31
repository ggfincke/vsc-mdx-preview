// tests/extension/handlers/JsonHandler.test.ts
// unit tests for JSON file handler

import { describe, it, expect } from 'vitest';
import { JsonHandler } from '../../../packages/extension/module-system/handlers/JsonHandler';
import type { Preview } from '../../../packages/extension/preview/preview-manager';

const mockPreview = {} as Preview;

describe('JsonHandler', () => {
  const handler = new JsonHandler();

  it('should handle .json extension', () => {
    expect(handler.extensions).toContain('.json');
  });

  it('wraps JSON content as module export', async () => {
    const json = '{"name":"mdx-preview","enabled":true}';
    const fsPath = '/path/to/config.json';

    const result = await handler.handle(json, fsPath, mockPreview);

    expect(result.code).toBe(`module.exports = ${json}`);
    expect(result.dependencies).toEqual([]);
    expect(result.fsPath).toBe(fsPath);
  });

  it('handles empty object', async () => {
    const json = '{}';
    const fsPath = '/path/to/empty.json';

    const result = await handler.handle(json, fsPath, mockPreview);

    expect(result.code).toBe('module.exports = {}');
  });

  it('preserves raw JSON content', async () => {
    const json = '{\n  "a": 1,\n  "b": [1, 2, 3]\n}';
    const fsPath = '/path/to/raw.json';

    const result = await handler.handle(json, fsPath, mockPreview);

    expect(result.code).toBe(`module.exports = ${json}`);
  });

  it('does not validate JSON syntax', async () => {
    const json = '{ invalid json }';
    const fsPath = '/path/to/invalid.json';

    const result = await handler.handle(json, fsPath, mockPreview);

    expect(result.code).toBe(`module.exports = ${json}`);
  });
});
