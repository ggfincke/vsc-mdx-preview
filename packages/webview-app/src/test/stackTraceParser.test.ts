// packages/webview-app/src/test/stackTraceParser.test.ts
// tests for error stack trace parsing utilities

import { describe, it, expect } from 'vitest';
import {
  parseStackTrace,
  getFirstLocation,
  isUserCode,
  getDisplayPath,
} from '../utils/stackTraceParser';

describe('stackTraceParser', () => {
  describe('parseStackTrace', () => {
    it('returns empty array for empty string', () => {
      expect(parseStackTrace('')).toEqual([]);
    });

    it('parses Chrome/V8 format with function name', () => {
      const stack = '    at myFunction (/path/to/file.js:10:5)';
      const frames = parseStackTrace(stack);

      expect(frames).toHaveLength(1);
      expect(frames[0].functionName).toBe('myFunction');
      expect(frames[0].filePath).toBe('/path/to/file.js');
      expect(frames[0].line).toBe(10);
      expect(frames[0].column).toBe(5);
      expect(frames[0].isNavigable).toBe(true);
    });

    it('parses Chrome/V8 format without function name', () => {
      const stack = '    at /path/to/file.js:10:5';
      const frames = parseStackTrace(stack);

      expect(frames).toHaveLength(1);
      expect(frames[0].functionName).toBeUndefined();
      expect(frames[0].filePath).toBe('/path/to/file.js');
      expect(frames[0].line).toBe(10);
      expect(frames[0].column).toBe(5);
      expect(frames[0].isNavigable).toBe(true);
    });

    it('parses Firefox format', () => {
      const stack = 'myFunction@/path/to/file.js:10:5';
      const frames = parseStackTrace(stack);

      expect(frames).toHaveLength(1);
      expect(frames[0].functionName).toBe('myFunction');
      expect(frames[0].filePath).toBe('/path/to/file.js');
      expect(frames[0].line).toBe(10);
      expect(frames[0].column).toBe(5);
      expect(frames[0].isNavigable).toBe(true);
    });

    it('parses multiple frames', () => {
      const stack = `Error: Something went wrong
    at functionA (/path/a.js:1:1)
    at functionB (/path/b.js:2:2)
    at functionC (/path/c.js:3:3)`;

      const frames = parseStackTrace(stack);

      expect(frames).toHaveLength(4);
      // error message line
      expect(frames[0].isNavigable).toBe(false);
      expect(frames[1].functionName).toBe('functionA');
      expect(frames[2].functionName).toBe('functionB');
      expect(frames[3].functionName).toBe('functionC');
    });

    it('includes error message as non-navigable frame', () => {
      const stack = `TypeError: Cannot read property 'foo' of undefined
    at Object.<anonymous> (/test.js:1:1)`;

      const frames = parseStackTrace(stack);

      expect(frames[0].isNavigable).toBe(false);
      expect(frames[0].raw).toContain('TypeError');
    });

    it('cleans file:// prefix from paths', () => {
      const stack = '    at fn (file:///path/to/file.js:10:5)';
      const frames = parseStackTrace(stack);

      expect(frames[0].filePath).toBe('/path/to/file.js');
    });

    it('removes query strings from paths', () => {
      const stack = '    at fn (/path/to/file.js?v=123:10:5)';
      const frames = parseStackTrace(stack);

      expect(frames[0].filePath).toBe('/path/to/file.js');
    });

    it('skips empty lines', () => {
      const stack = `    at fn (/a.js:1:1)

    at fn2 (/b.js:2:2)`;

      const frames = parseStackTrace(stack);
      // should have 2 navigable frames, no empty ones
      const navigable = frames.filter((f) => f.isNavigable);
      expect(navigable).toHaveLength(2);
    });
  });

  describe('getFirstLocation', () => {
    it('returns first navigable frame', () => {
      const stack = `Error: test
    at first (/first.js:1:1)
    at second (/second.js:2:2)`;

      const location = getFirstLocation(stack);

      expect(location).toEqual({
        filePath: '/first.js',
        line: 1,
        column: 1,
      });
    });

    it('returns null for empty stack', () => {
      expect(getFirstLocation('')).toBeNull();
    });

    it('returns null for stack with no navigable frames', () => {
      const stack = 'Error: something went wrong';
      expect(getFirstLocation(stack)).toBeNull();
    });

    it('skips non-navigable frames to find first navigable', () => {
      const stack = `Error: test
Some other info
    at actual (/file.js:5:10)`;

      const location = getFirstLocation(stack);

      expect(location?.filePath).toBe('/file.js');
      expect(location?.line).toBe(5);
    });
  });

  describe('isUserCode', () => {
    it('returns false for node_modules paths', () => {
      expect(isUserCode('/project/node_modules/react/index.js')).toBe(false);
    });

    it('returns false for chrome-extension:// paths', () => {
      expect(isUserCode('chrome-extension://abc123/script.js')).toBe(false);
    });

    it('returns false for vscode-webview:// paths', () => {
      expect(isUserCode('vscode-webview://abc/script.js')).toBe(false);
    });

    it('returns false for extensions/ paths', () => {
      expect(isUserCode('/path/extensions/some-ext/file.js')).toBe(false);
    });

    it('returns false for webpack:// paths', () => {
      expect(isUserCode('webpack://module/file.js')).toBe(false);
    });

    it('returns false for __vite_ paths', () => {
      expect(isUserCode('/path/__vite_browser.js')).toBe(false);
    });

    it('returns true for user project paths', () => {
      expect(isUserCode('/home/user/project/src/App.tsx')).toBe(true);
    });

    it('returns true for relative paths', () => {
      expect(isUserCode('./src/component.js')).toBe(true);
    });
  });

  describe('getDisplayPath', () => {
    it('returns last 2 segments of path', () => {
      expect(getDisplayPath('/home/user/project/src/file.js')).toBe(
        'src/file.js'
      );
    });

    it('handles Windows-style paths', () => {
      expect(getDisplayPath('C:\\Users\\project\\src\\file.js')).toBe(
        'src/file.js'
      );
    });

    it('returns single segment if path has only one', () => {
      expect(getDisplayPath('file.js')).toBe('file.js');
    });

    it('returns filename and parent for 2-segment path', () => {
      expect(getDisplayPath('src/file.js')).toBe('src/file.js');
    });

    it('handles empty string', () => {
      expect(getDisplayPath('')).toBe('');
    });
  });
});
