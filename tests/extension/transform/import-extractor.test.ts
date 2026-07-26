// tests/extension/transform/import-extractor.test.ts
// verify mixed module syntax extraction stays ordered & ignores inert text

import { describe, expect, it } from 'vitest';
import { createImportRuntimeRequest as createForgeImportRuntimeRequest } from 'mdx-forge/browser';
import {
  createImportRuntimeRequest,
  extractImportSpecifiers,
  extractModuleDependencies,
  rewriteImportRuntimeRequests,
} from '../../../packages/extension-host/src/features/module-runtime/dependencies/import-extractor';
import { ScriptHandler } from '../../../packages/extension-host/src/features/module-runtime/handlers/ScriptHandler';
import { transformEntry } from '../../../packages/extension-host/src/features/module-runtime/transform/transform';
import type { ModuleExecutionContext } from '../../../packages/extension-host/src/features/module-runtime/types/handlers';

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

describe('mixed import extraction', () => {
  it('extracts ESM & CommonJS specifiers in source order with dedupe', async () => {
    const code = `
      const first = require('first');
      import second from 'second';
      const duplicate = require('second');
      // require('comment-only');
      const inert = "require('string-only')";
      export { third } from 'third';
    `;

    await expect(extractImportSpecifiers(code)).resolves.toEqual([
      'first',
      'second',
      'third',
    ]);

    const rewritten = await rewriteImportRuntimeRequests(code);
    expect(createImportRuntimeRequest('second')).toBe(
      createForgeImportRuntimeRequest('second')
    );
    await expect(extractModuleDependencies(rewritten)).resolves.toEqual([
      {
        specifier: 'first',
        kind: 'require',
        runtimeRequest: 'first',
      },
      {
        specifier: 'second',
        kind: 'import',
        runtimeRequest: createImportRuntimeRequest('second'),
      },
      {
        specifier: 'second',
        kind: 'require',
        runtimeRequest: 'second',
      },
      {
        specifier: 'third',
        kind: 'import',
        runtimeRequest: createImportRuntimeRequest('third'),
      },
    ]);
  });

  it('scans executable require calls without admitting inert lexical text', async () => {
    const code = [
      "#!/usr/bin/env -S node require('hashbang-ghost')",
      "const inert = /require('regex-ghost')/giu;",
      "const ratio = 12 / require('division-real') / 2;",
      "const objectRatio = ({}) / require('object-division-real') / 2;",
      'object.break',
      "/ require('member-division-real') / 2;",
      "const escaped = /[\\/\"']require\\('class-ghost'\\)\\//giu;",
      "if (ready) /require('control-regex-ghost')/.test(source);",
      "export default async function declared() {} /require('declaration-regex-ghost')/.test(source);",
      "class Empty {} /require('class-regex-ghost')/.test(source);",
      "class Methods { method() {} } /require('class-method-regex-ghost')/.test(source);",
      "const classRatio = class {} / require('class-expression-real') / 2;",
      "label: {} /require('label-regex-ghost')/.test(source);",
      'function stop() { while (ready) {',
      '  break',
      "  /require('break-regex-ghost')/.test(source);",
      '  continue',
      "  /require('continue-regex-ghost')/.test(source);",
      '} }',
      'debugger',
      "/require('debugger-regex-ghost')/.test(source);",
      "<!-- require('html-open-ghost')",
      "--> require('html-close-ghost')",
      "const escapedMiddle = requ\\u0069re('escaped-middle');",
      "const escapedEnd = requir\\u{65}('escaped-end');",
      "const escapedStart = \\u0072equire('escaped-start');",
      "object.requ\\u0069re('escaped-member-ghost');",
      "object?.requ\\u0069re('escaped-optional-member-ghost');",
      "const direct = `value ${require('template-direct')}`;",
      "const nested = `outer ${{ value: `inner ${require('template-nested')}` }.value}`;",
      "const raw = `require('template-raw-ghost')`;",
      'const commented = require /* before call */ (',
      '  // before literal',
      "  'comment-real'",
      ');',
      "const lf = require('pack\\" + '\n' + "age');",
      "const crlf = require('crlf-\\" + '\r\n' + "package');",
    ].join('\n');

    await expect(extractImportSpecifiers(code)).resolves.toEqual([
      'division-real',
      'object-division-real',
      'member-division-real',
      'class-expression-real',
      'escaped-middle',
      'escaped-end',
      'escaped-start',
      'template-direct',
      'template-nested',
      'comment-real',
      'package',
      'crlf-package',
    ]);

    const escapedOnly = [
      "requ\\u0069re('escaped-only-middle');",
      "requir\\u{65}('escaped-only-end');",
      "\\u0072equire('escaped-only-start');",
    ].join('\n');
    await expect(extractImportSpecifiers(escapedOnly)).resolves.toEqual([
      'escaped-only-middle',
      'escaped-only-end',
      'escaped-only-start',
    ]);
    await expect(
      extractImportSpecifiers(
        [
          "object.requ\\u0069re('escaped-member-only-ghost');",
          "object?.requir\\u{65}('escaped-optional-only-ghost');",
        ].join('\n')
      )
    ).resolves.toEqual([]);

    const astOnlyBody = [
      'const invocationTarget = new.target;',
      'return (() => {',
      'class Private {',
      '  #require() {}',
      "  method() { this.#require('private-ghost'); class Inner {} /require('method-regex-ghost')/.test(source); }",
      "  static { class Inner {} /require('static-regex-ghost')/.test(source); }",
      '}',
      "const object = { method() { class Inner {} /require('object-method-regex-ghost')/.test(source); } };",
      "obj.class; {} /require('stale-class-regex-ghost')/.test(source);",
      "try {} catch {} /require('catch-regex-ghost')/.test(source);",
      "async: {} /require('async-label-regex-ghost')/.test(source);",
      "of: {} /require('of-label-regex-ghost')/.test(source);",
      "switch (kind) { case 1: {} /require('case-regex-ghost')/.test(source); break; default: {} /require('default-regex-ghost')/.test(source); }",
      'function done() { return',
      "{} /require('return-regex-ghost')/.test(source); }",
      "const objectRatio = `${{} / require('template-object-real') / 2}`;",
      "const classRatio = `${class {} / require('template-class-real') / 2}`;",
      "const functionRatio = `${function () {} / require('template-function-real') / 2}`;",
      "const optional = require?.('optional-real');",
      'return { invocationTarget, object, objectRatio, classRatio, functionRatio, optional };',
      '})();',
    ].join('\n');
    expect(() => new Function(astOnlyBody)).not.toThrow();
    await expect(extractImportSpecifiers(astOnlyBody)).resolves.toEqual([
      'template-object-real',
      'template-class-real',
      'template-function-real',
      'optional-real',
    ]);

    const typedJsx = [
      "const view = <div>require('jsx-text-ghost'){require('jsx-expression-real')}</div>;",
      'interface Shape {}',
      "abstract class Abstract {} /require('abstract-regex-ghost')/.test(source);",
      "enum Kind {} /require('enum-regex-ghost')/.test(source);",
      "namespace Space {} /require('namespace-regex-ghost')/.test(source);",
      "@sealed class Decorated {} /require('decorator-regex-ghost')/.test(source);",
      "const runtime = require('typed-runtime-real');",
    ].join('\n');
    await expect(extractImportSpecifiers(typedJsx)).resolves.toEqual([
      'jsx-expression-real',
      'typed-runtime-real',
    ]);

    const runtimeCalls = [
      "require('global-control');",
      "require('extra-real', undefined);",
      "require('spread-real', ...extras);",
    ].join('\n');
    await expect(extractImportSpecifiers(runtimeCalls)).resolves.toEqual([
      'global-control',
      'extra-real',
      'spread-real',
    ]);

    const shadowedCalls = [
      'const require = (value) => value;',
      "require('local-ghost');",
      "function nested(require) { require('parameter-ghost'); }",
    ].join('\n');
    await expect(extractImportSpecifiers(shadowedCalls)).resolves.toEqual([]);
    await expect(
      extractImportSpecifiers(
        "import { require } from 'loader'; require('imported-ghost');"
      )
    ).resolves.toEqual(['loader']);

    const sloppyOctal = String.raw`require('\160kg');`;
    let runtimeSpecifier = '';
    new Function('require', sloppyOctal)((specifier: string) => {
      runtimeSpecifier = specifier;
    });
    expect(runtimeSpecifier).toBe('pkg');
    await expect(extractImportSpecifiers(sloppyOctal)).resolves.toEqual([
      'pkg',
    ]);

    const deepJsx =
      `const tree = ${'<Node>'.repeat(500)}` +
      `require('deep-jsx-text-ghost')${'</Node>'.repeat(500)};`;
    await expect(extractImportSpecifiers(deepJsx)).resolves.toEqual([]);

    const malformed = [
      "const broken = /require('malformed-regex-ghost')",
      "const escaped = /require('escaped-regex-ghost')\\",
      "const recovered = require('after-malformed');",
    ].join('\n');
    await expect(extractImportSpecifiers(malformed)).resolves.toEqual([
      'after-malformed',
    ]);
  });

  it('rewrites every minified static ESM form as an import dependency', async () => {
    const code = [
      "import'one'",
      "/require('side-effect-regex-ghost')/.test(source);",
      "import{x}from'two'",
      "/require('import-from-regex-ghost')/.test(source);",
      "export{x as y}from'three'",
      "/require('export-from-regex-ghost')/.test(source);",
      "export*from'four'",
      "/require('export-star-regex-ghost')/.test(source);",
    ].join('\n');
    const expected = ['one', 'two', 'three', 'four'].map((specifier) => ({
      specifier,
      kind: 'import' as const,
      runtimeRequest: createImportRuntimeRequest(specifier),
    }));

    await expect(extractModuleDependencies(code)).resolves.toEqual(expected);
    await expect(
      extractModuleDependencies(await rewriteImportRuntimeRequests(code))
    ).resolves.toEqual(expected);

    const attributed =
      "import data from './data.json' with { type: 'json' };" +
      "const runtime = require('attribute-runtime-real');";
    await expect(extractImportSpecifiers(attributed)).resolves.toEqual([
      './data.json',
      'attribute-runtime-real',
    ]);
  });

  it('preserves computed imports & excludes erased TypeScript dependencies', async () => {
    const dynamicSource = [
      'const specifier = "data:text/javascript,export default \'native\'";',
      "const literal = () => import('literal-package');",
      'export default async function load() {',
      '  return (await import(specifier)).default;',
      '}',
    ].join('\n');

    for (const useSucrase of [false, true]) {
      const entry = await transformEntry(
        dynamicSource,
        '/workspace/entry.js',
        {
          doc: {
            languageId: 'javascript',
            uri: { scheme: 'file' },
          },
          configuration: { useSucraseTranspiler: useSucrase },
        } as never,
        {} as never
      );
      expect(entry.code).toMatch(/\bimport\s*\(\s*specifier\s*\)/);
      expect(entry.code).not.toMatch(/\brequire\s*\(\s*specifier\s*\)/);
      expect(entry.code).toContain('mdx-forge:import');
      expect(entry.code).toContain('exports.default');
      await expect(extractModuleDependencies(entry.esmCode)).resolves.toEqual([
        {
          specifier: 'literal-package',
          kind: 'import',
          runtimeRequest: createImportRuntimeRequest('literal-package'),
        },
      ]);

      const exports = {};
      const module = { exports };
      new Function('require', 'module', 'exports', entry.code)(
        () => {
          throw new Error('literal import should stay lazy');
        },
        module,
        exports
      );
      const load = (module.exports as { default: () => Promise<string> })
        .default;
      await expect(load()).rejects.toMatchObject({
        code: 'ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING',
      });

      const dependency = await new ScriptHandler().handle(
        dynamicSource,
        '/workspace/dependency.js',
        createContext(useSucrase)
      );
      expect(dependency.code).toMatch(/\bimport\s*\(\s*specifier\s*\)/);
      expect(dependency.code).not.toMatch(/\brequire\s*\(\s*specifier\s*\)/);
      expect(dependency.dependencies).toEqual([
        {
          specifier: 'literal-package',
          kind: 'import',
          runtimeRequest: createImportRuntimeRequest('literal-package'),
        },
      ]);
    }

    const typeScriptSource = [
      "import type { Foo } from 'types-a';",
      "export type { Bar } from 'types-b';",
      "type ModuleType = import('types-c').Thing;",
      "type ModuleNamespace = typeof import('types-d');",
      "interface Shape { value: import('types-e').Thing }",
      "import type Alias = require('types-f');",
      "import Runtime = require('runtime-g');",
      "import { value } from 'value-h';",
      'console.log(Runtime, value);',
    ].join('\n');
    const typeScript = await new ScriptHandler().handle(
      typeScriptSource,
      '/workspace/dependency.ts',
      createContext(true)
    );
    expect(typeScript.dependencies).toEqual([
      {
        specifier: 'runtime-g',
        kind: 'require',
        runtimeRequest: 'runtime-g',
      },
      {
        specifier: 'value-h',
        kind: 'import',
        runtimeRequest: createImportRuntimeRequest('value-h'),
      },
    ]);
    expect(typeScript.code).not.toContain('types-');
  });
});
