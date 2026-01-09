// packages/extension/test/transpiler-parity.test.ts
// tests for Babel & Sucrase transpiler parity

import { describe, it, expect } from 'vitest';
import { transformAsync as babelTransform } from '../transpiler/babel';
import { transform as sucraseTransform } from '../transpiler/sucrase';

describe('Transpiler Parity', () => {
  // helper to check if output is valid (non-empty, no errors)
  function isValidOutput(output: string | null | undefined): boolean {
    return typeof output === 'string' && output.length > 0;
  }

  describe('arrow functions', () => {
    const code = 'const fn = (a, b) => a + b;';

    it('Babel transforms arrow functions', async () => {
      const result = await babelTransform(code);
      expect(isValidOutput(result?.code)).toBe(true);
    });

    it('Sucrase transforms arrow functions', () => {
      const result = sucraseTransform(code);
      expect(isValidOutput(result?.code)).toBe(true);
    });
  });

  describe('optional chaining', () => {
    const code = 'const value = obj?.prop?.nested;';

    it('Babel transforms optional chaining', async () => {
      const result = await babelTransform(code);
      expect(isValidOutput(result?.code)).toBe(true);
      // should not contain ?. after transform
      expect(result?.code).not.toContain('?.');
    });

    it('Sucrase transforms optional chaining', () => {
      const result = sucraseTransform(code);
      expect(isValidOutput(result?.code)).toBe(true);
    });
  });

  describe('nullish coalescing', () => {
    const code = 'const value = input ?? defaultValue;';

    it('Babel transforms nullish coalescing', async () => {
      const result = await babelTransform(code);
      expect(isValidOutput(result?.code)).toBe(true);
      expect(result?.code).not.toContain('??');
    });

    it('Sucrase transforms nullish coalescing', () => {
      const result = sucraseTransform(code);
      expect(isValidOutput(result?.code)).toBe(true);
    });
  });

  describe('template literals', () => {
    const code = 'const msg = `Hello ${name}!`;';

    it('Babel transforms template literals', async () => {
      const result = await babelTransform(code);
      expect(isValidOutput(result?.code)).toBe(true);
    });

    it('Sucrase transforms template literals', () => {
      const result = sucraseTransform(code);
      expect(isValidOutput(result?.code)).toBe(true);
    });
  });

  describe('destructuring', () => {
    const code = 'const { a, b, c: renamed } = obj;';

    it('Babel transforms destructuring', async () => {
      const result = await babelTransform(code);
      expect(isValidOutput(result?.code)).toBe(true);
    });

    it('Sucrase transforms destructuring', () => {
      const result = sucraseTransform(code);
      expect(isValidOutput(result?.code)).toBe(true);
    });
  });

  describe('spread operator', () => {
    const code = 'const merged = { ...obj1, ...obj2 };';

    it('Babel transforms spread operator', async () => {
      const result = await babelTransform(code);
      expect(isValidOutput(result?.code)).toBe(true);
    });

    it('Sucrase transforms spread operator', () => {
      const result = sucraseTransform(code);
      expect(isValidOutput(result?.code)).toBe(true);
    });
  });

  describe('JSX elements', () => {
    const code = 'const el = <div className="test">Hello</div>;';

    it('Babel transforms JSX', async () => {
      const result = await babelTransform(code);
      expect(isValidOutput(result?.code)).toBe(true);
      // JSX should be transformed to React.createElement or similar
      expect(result?.code).not.toContain('<div');
    });

    it('Sucrase transforms JSX', () => {
      const result = sucraseTransform(code);
      expect(isValidOutput(result?.code)).toBe(true);
      expect(result?.code).not.toContain('<div');
    });
  });

  describe('class properties', () => {
    const code = `class Foo {
      state = { count: 0 };
      handleClick = () => {};
    }`;

    it('Babel transforms class properties', async () => {
      const result = await babelTransform(code);
      expect(isValidOutput(result?.code)).toBe(true);
    });

    it('Sucrase transforms class properties', () => {
      const result = sucraseTransform(code);
      expect(isValidOutput(result?.code)).toBe(true);
    });
  });

  describe('async/await', () => {
    const code = `async function fetchData() {
      const result = await fetch('/api');
      return result.json();
    }`;

    it('Babel transforms async/await', async () => {
      const result = await babelTransform(code);
      expect(isValidOutput(result?.code)).toBe(true);
    });

    it('Sucrase transforms async/await', () => {
      const result = sucraseTransform(code);
      expect(isValidOutput(result?.code)).toBe(true);
    });
  });

  describe('TypeScript syntax', () => {
    const code = `
      interface Props { name: string; }
      const greet = (props: Props): string => \`Hello \${props.name}\`;
    `;

    it('Sucrase strips TypeScript types', () => {
      const result = sucraseTransform(code);
      expect(isValidOutput(result?.code)).toBe(true);
      // Types should be stripped
      expect(result?.code).not.toContain('interface');
      expect(result?.code).not.toContain(': string');
    });
  });

  describe('import/export', () => {
    const code = `
      import React from 'react';
      export const Component = () => <div />;
      export default Component;
    `;

    it('Babel transforms imports/exports', async () => {
      const result = await babelTransform(code);
      expect(isValidOutput(result?.code)).toBe(true);
      // ES modules converted to CommonJS by preset-env
      expect(result?.code).toContain('require');
    });

    it('Sucrase transforms imports/exports', () => {
      const result = sucraseTransform(code);
      expect(isValidOutput(result?.code)).toBe(true);
      expect(result?.code).toContain('require');
    });
  });

  describe('self-closing JSX', () => {
    const code = 'const el = <img src="test.jpg" />;';

    it('Babel transforms self-closing JSX', async () => {
      const result = await babelTransform(code);
      expect(isValidOutput(result?.code)).toBe(true);
      expect(result?.code).not.toContain('<img');
    });

    it('Sucrase transforms self-closing JSX', () => {
      const result = sucraseTransform(code);
      expect(isValidOutput(result?.code)).toBe(true);
      expect(result?.code).not.toContain('<img');
    });
  });

  describe('JSX fragments', () => {
    const code = 'const el = <><div /><span /></>;';

    it('Babel transforms JSX fragments', async () => {
      const result = await babelTransform(code);
      expect(isValidOutput(result?.code)).toBe(true);
      expect(result?.code).not.toContain('<>');
    });

    it('Sucrase transforms JSX fragments', () => {
      const result = sucraseTransform(code);
      expect(isValidOutput(result?.code)).toBe(true);
      expect(result?.code).not.toContain('<>');
    });
  });
});
