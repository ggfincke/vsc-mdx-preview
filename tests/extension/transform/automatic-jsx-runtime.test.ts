// tests/extension/transform/automatic-jsx-runtime.test.ts
// verify JSX dependencies use the automatic runtime in every transpiler path

import { describe, expect, it, vi } from 'vitest';
import type { ModuleExecutionContext } from '../../../packages/extension-host/src/features/module-runtime/types/handlers';
import { ScriptHandler } from '../../../packages/extension-host/src/features/module-runtime/handlers/ScriptHandler';

const cases = [
  {
    fsPath: '/workspace/Component.jsx',
    code: 'export default function Component() { return <div>JSX</div>; }',
    useSucrase: false,
  },
  {
    fsPath: '/workspace/Component.jsx',
    code: 'export default function Component() { return <div>JSX</div>; }',
    useSucrase: true,
  },
  {
    fsPath: '/workspace/Component.TSX',
    code: `type Props = { label: string };
      export default function Component(props: Props) {
        return <div>{props.label}</div>;
      }`,
    useSucrase: false,
  },
  {
    fsPath: '/workspace/Component.TSX',
    code: `type Props = { label: string };
      export default function Component(props: Props) {
        return <div>{props.label}</div>;
      }`,
    useSucrase: true,
  },
];

function createContext(useSucrase: boolean): ModuleExecutionContext {
  return {
    documentUri: {
      scheme: 'file',
      fsPath: '/workspace/entry.mdx',
    } as ModuleExecutionContext['documentUri'],
    entryFsDirectory: '/workspace',
    useSucraseTranspiler: useSucrase,
    getWebviewUri: () => undefined,
  };
}

describe('automatic JSX runtime', () => {
  it.each(cases)(
    'transforms $fsPath w/ Sucrase=$useSucrase without a React global',
    async ({ code, fsPath, useSucrase }) => {
      const result = await new ScriptHandler().handle(
        code,
        fsPath,
        createContext(useSucrase)
      );

      expect(result.dependencies).toContainEqual({
        specifier: 'react/jsx-runtime',
        kind: 'require',
        runtimeRequest: 'react/jsx-runtime',
      });

      const runtime = {
        jsx: (type: string, props: Record<string, unknown>) => ({
          type,
          props,
        }),
        jsxs: (type: string, props: Record<string, unknown>) => ({
          type,
          props,
        }),
      };
      const requireModule = vi.fn((specifier: string) => {
        expect(specifier).toBe('react/jsx-runtime');
        return runtime;
      });
      const exports = {};
      const module = { exports };
      new Function('require', 'module', 'exports', result.code)(
        requireModule,
        module,
        exports
      );

      const component = (
        module.exports as unknown as {
          default: (props: { label: string }) => {
            type: string;
            props: Record<string, unknown>;
          };
        }
      ).default;
      expect(component({ label: 'TSX' }).type).toBe('div');
    }
  );

  it.each([false, true])(
    'strips types from uppercase .TS dependencies w/ Sucrase=%s',
    async (useSucrase) => {
      const result = await new ScriptHandler().handle(
        'export const answer: number = 42;',
        '/workspace/value.TS',
        createContext(useSucrase)
      );

      expect(result.code).not.toContain(': number');
    }
  );
});
