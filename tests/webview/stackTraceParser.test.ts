// tests/webview/stackTraceParser.test.ts
// tests navigable stack locations across common runtime formats

import { describe, expect, it } from 'vitest';
import { parseStackTrace } from '../../packages/webview-client/src/shared/utils/stackTraceParser';

describe('stackTraceParser', () => {
  it('parses stack syntax & path-shaped bare locations without matching prose', () => {
    const cases = [
      {
        input: '    at render (/workspace/src/App.tsx:12:7)',
        expected: {
          functionName: 'render',
          filePath: '/workspace/src/App.tsx',
          line: 12,
          column: 7,
          isNavigable: true,
        },
      },
      {
        input: 'render@/workspace/src/App.tsx:13:8',
        expected: {
          functionName: 'render',
          filePath: '/workspace/src/App.tsx',
          line: 13,
          column: 8,
          isNavigable: true,
        },
      },
      {
        input: '/workspace/src/App.tsx:14:9',
        expected: {
          filePath: '/workspace/src/App.tsx',
          line: 14,
          column: 9,
          isNavigable: true,
        },
      },
      {
        input: 'src/App.tsx:15:10',
        expected: {
          filePath: 'src/App.tsx',
          line: 15,
          column: 10,
          isNavigable: true,
        },
      },
      {
        input: String.raw`C:\workspace\src\App.tsx:16:11`,
        expected: {
          filePath: String.raw`C:\workspace\src\App.tsx`,
          line: 16,
          column: 11,
          isNavigable: true,
        },
      },
      {
        input: 'Unexpected token:1:2',
        expected: {
          isNavigable: false,
        },
      },
    ];

    for (const { input, expected } of cases) {
      const [frame] = parseStackTrace(input);
      expect(frame).toMatchObject({ raw: input, ...expected });
      if (!expected.isNavigable) {
        expect(frame.filePath).toBeUndefined();
      }
    }
  });
});
