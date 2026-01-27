// tests/validation/validation.test.ts
// comprehensive tests for validation utilities

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateString,
  validateBoolean,
  validateNumber,
  validateFunction,
  validateOptionalNumber,
  validateUrl,
  validateArray,
  validateObject,
  validateRecord,
  validateEnumValue,
  validatePluginSpec,
  validateConfigSchema,
} from '../../packages/extension/utils/validation';

// mock logging to avoid output during tests
vi.mock('../../packages/extension/logging', () => ({
  warn: vi.fn(),
  error: vi.fn(),
}));

describe('primitives', () => {
  describe('validateString', () => {
    it('returns string for valid input', () => {
      expect(validateString('hello', 'test')).toBe('hello');
    });

    it('returns undefined for non-string types', () => {
      expect(validateString(123, 'test')).toBeUndefined();
      expect(validateString(true, 'test')).toBeUndefined();
      expect(validateString(null, 'test')).toBeUndefined();
      expect(validateString(undefined, 'test')).toBeUndefined();
      expect(validateString({}, 'test')).toBeUndefined();
      expect(validateString([], 'test')).toBeUndefined();
    });

    it('returns undefined for empty/whitespace string by default', () => {
      expect(validateString('', 'test')).toBeUndefined();
      expect(validateString('   ', 'test')).toBeUndefined();
      expect(validateString('\t\n', 'test')).toBeUndefined();
    });

    it('allows empty string when allowEmpty: true', () => {
      expect(validateString('', 'test', { allowEmpty: true })).toBe('');
    });

    it('preserves whitespace in non-empty strings', () => {
      expect(validateString('  hello  ', 'test')).toBe('  hello  ');
    });
  });

  describe('validateBoolean', () => {
    it('returns boolean for valid input', () => {
      expect(validateBoolean(true, 'test')).toBe(true);
      expect(validateBoolean(false, 'test')).toBe(false);
    });

    it('returns undefined for non-boolean types', () => {
      expect(validateBoolean('true', 'test')).toBeUndefined();
      expect(validateBoolean(1, 'test')).toBeUndefined();
      expect(validateBoolean(0, 'test')).toBeUndefined();
      expect(validateBoolean(null, 'test')).toBeUndefined();
    });
  });

  describe('validateNumber', () => {
    it('returns number for valid input', () => {
      expect(validateNumber(42, 'test')).toBe(42);
      expect(validateNumber(0, 'test')).toBe(0);
      expect(validateNumber(-5, 'test')).toBe(-5);
      expect(validateNumber(3.14, 'test')).toBe(3.14);
    });

    it('returns undefined for non-number types', () => {
      expect(validateNumber('42', 'test')).toBeUndefined();
      expect(validateNumber(true, 'test')).toBeUndefined();
      expect(validateNumber(null, 'test')).toBeUndefined();
    });

    it('rejects Infinity by default', () => {
      expect(validateNumber(Infinity, 'test')).toBeUndefined();
      expect(validateNumber(-Infinity, 'test')).toBeUndefined();
    });

    it('allows Infinity when finite: false', () => {
      expect(validateNumber(Infinity, 'test', { finite: false })).toBe(
        Infinity
      );
    });

    it('rejects NaN', () => {
      expect(validateNumber(NaN, 'test')).toBeUndefined();
    });

    it('validates min constraint', () => {
      expect(validateNumber(5, 'test', { min: 10 })).toBeUndefined();
      expect(validateNumber(10, 'test', { min: 10 })).toBe(10);
      expect(validateNumber(15, 'test', { min: 10 })).toBe(15);
    });

    it('validates max constraint', () => {
      expect(validateNumber(15, 'test', { max: 10 })).toBeUndefined();
      expect(validateNumber(10, 'test', { max: 10 })).toBe(10);
      expect(validateNumber(5, 'test', { max: 10 })).toBe(5);
    });

    it('validates min and max together', () => {
      expect(validateNumber(5, 'test', { min: 10, max: 20 })).toBeUndefined();
      expect(validateNumber(25, 'test', { min: 10, max: 20 })).toBeUndefined();
      expect(validateNumber(15, 'test', { min: 10, max: 20 })).toBe(15);
    });
  });

  describe('validateFunction', () => {
    it('returns function for valid input', () => {
      const fn = () => {};
      expect(validateFunction(fn, 'test')).toBe(fn);
    });

    it('returns undefined for non-function types', () => {
      expect(validateFunction('function', 'test')).toBeUndefined();
      expect(validateFunction({}, 'test')).toBeUndefined();
      expect(validateFunction(null, 'test')).toBeUndefined();
    });
  });
});

describe('optional validators', () => {
  describe('validateOptionalNumber', () => {
    it('returns undefined for undefined input (no error)', () => {
      expect(validateOptionalNumber(undefined, 'test')).toBeUndefined();
    });

    it('validates number when present', () => {
      expect(validateOptionalNumber(42, 'test')).toBe(42);
    });

    it('returns undefined for invalid number', () => {
      expect(validateOptionalNumber('42', 'test')).toBeUndefined();
    });
  });
});

describe('url validation', () => {
  describe('validateUrl', () => {
    it('returns URL for valid input', () => {
      const result = validateUrl('https://example.com', 'test');
      expect(result).toBeInstanceOf(URL);
      expect(result?.href).toBe('https://example.com/');
    });

    it('returns undefined for invalid URL', () => {
      expect(validateUrl('not a url', 'test')).toBeUndefined();
    });

    it('returns undefined for non-string', () => {
      expect(validateUrl(123, 'test')).toBeUndefined();
    });

    it('validates allowed schemes', () => {
      const opts = { allowedSchemes: ['https:'] };
      expect(validateUrl('https://example.com', 'test', opts)).toBeDefined();
      expect(validateUrl('http://example.com', 'test', opts)).toBeUndefined();
    });
  });
});

describe('collections', () => {
  describe('validateArray', () => {
    it('returns array for valid input', () => {
      expect(validateArray([1, 2, 3], 'test')).toEqual([1, 2, 3]);
    });

    it('returns undefined for non-array types', () => {
      expect(validateArray('array', 'test')).toBeUndefined();
      expect(validateArray({ 0: 'a' }, 'test')).toBeUndefined();
      expect(validateArray(null, 'test')).toBeUndefined();
    });

    it('validates elements with element validator', () => {
      const numberValidator = (el: unknown) =>
        typeof el === 'number' ? el : undefined;
      expect(validateArray([1, 2, 3], 'test', numberValidator)).toEqual([
        1, 2, 3,
      ]);
      expect(
        validateArray([1, 'two', 3], 'test', numberValidator)
      ).toBeUndefined();
    });
  });

  describe('validateObject', () => {
    it('returns object for valid input', () => {
      const obj = { key: 'value' };
      expect(validateObject(obj, 'test')).toEqual(obj);
    });

    it('returns undefined for non-object types', () => {
      expect(validateObject('object', 'test')).toBeUndefined();
      expect(validateObject(null, 'test')).toBeUndefined();
      expect(validateObject([], 'test')).toBeUndefined();
    });
  });

  describe('validateRecord', () => {
    it('returns record for valid input', () => {
      const stringValidator = (v: unknown) =>
        typeof v === 'string' ? v : undefined;
      expect(
        validateRecord({ a: 'one', b: 'two' }, 'test', stringValidator)
      ).toEqual({ a: 'one', b: 'two' });
    });

    it('returns undefined if any value is invalid', () => {
      const stringValidator = (v: unknown) =>
        typeof v === 'string' ? v : undefined;
      expect(
        validateRecord({ a: 'one', b: 123 }, 'test', stringValidator)
      ).toBeUndefined();
    });
  });
});

describe('enum and schema validation', () => {
  describe('validateEnumValue', () => {
    const ALLOWED = ['red', 'green', 'blue'] as const;

    it('returns value for valid enum', () => {
      expect(validateEnumValue('red', 'test', ALLOWED)).toBe('red');
      expect(validateEnumValue('green', 'test', ALLOWED)).toBe('green');
    });

    it('returns undefined for invalid enum', () => {
      expect(validateEnumValue('yellow', 'test', ALLOWED)).toBeUndefined();
    });

    it('returns undefined for non-string', () => {
      expect(validateEnumValue(123, 'test', ALLOWED)).toBeUndefined();
    });
  });

  describe('validatePluginSpec', () => {
    it('accepts string plugin name', () => {
      expect(validatePluginSpec('remark-gfm', 'test')).toBe('remark-gfm');
    });

    it('rejects empty string', () => {
      expect(validatePluginSpec('', 'test')).toBeUndefined();
      expect(validatePluginSpec('   ', 'test')).toBeUndefined();
    });

    it('accepts [name, options] tuple', () => {
      const spec = ['remark-toc', { maxDepth: 3 }];
      expect(validatePluginSpec(spec, 'test')).toEqual(spec);
    });

    it('rejects tuple with wrong length', () => {
      expect(validatePluginSpec(['only-one'], 'test')).toBeUndefined();
      expect(
        validatePluginSpec(['one', {}, 'three'], 'test')
      ).toBeUndefined();
    });

    it('rejects tuple with non-string name', () => {
      expect(validatePluginSpec([123, {}], 'test')).toBeUndefined();
    });

    it('rejects tuple with non-object options', () => {
      expect(validatePluginSpec(['name', 'options'], 'test')).toBeUndefined();
      expect(validatePluginSpec(['name', null], 'test')).toBeUndefined();
      expect(validatePluginSpec(['name', []], 'test')).toBeUndefined();
    });

    it('rejects other types', () => {
      expect(validatePluginSpec(123, 'test')).toBeUndefined();
      expect(validatePluginSpec({}, 'test')).toBeUndefined();
    });
  });

  describe('validateConfigSchema', () => {
    it('validates empty config', () => {
      const result = validateConfigSchema({});
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.config).toEqual({});
    });

    it('validates remarkPlugins array', () => {
      const result = validateConfigSchema({
        remarkPlugins: ['remark-gfm', ['remark-toc', { maxDepth: 3 }]],
      });
      expect(result.valid).toBe(true);
      expect(result.config?.remarkPlugins).toHaveLength(2);
    });

    it('validates rehypePlugins array', () => {
      const result = validateConfigSchema({
        rehypePlugins: ['rehype-slug'],
      });
      expect(result.valid).toBe(true);
      expect(result.config?.rehypePlugins).toEqual(['rehype-slug']);
    });

    it('validates components record', () => {
      const result = validateConfigSchema({
        components: { Callout: './components/Callout.tsx' },
      });
      expect(result.valid).toBe(true);
      expect(result.config?.components).toEqual({
        Callout: './components/Callout.tsx',
      });
    });

    it('validates framework enum', () => {
      expect(
        validateConfigSchema({ framework: 'docusaurus' }).config?.framework
      ).toBe('docusaurus');
      expect(
        validateConfigSchema({ framework: 'invalid' }).valid
      ).toBe(false);
    });

    it('validates frameworkOptions', () => {
      const result = validateConfigSchema({
        frameworkOptions: {
          enableShims: true,
          customAliases: { '@components': './src/components' },
        },
      });
      expect(result.valid).toBe(true);
      expect(result.config?.frameworkOptions?.enableShims).toBe(true);
    });

    it('validates tailwind options', () => {
      const result = validateConfigSchema({
        tailwind: {
          enabled: 'auto',
          configPath: './tailwind.config.js',
        },
      });
      expect(result.valid).toBe(true);
      expect(result.config?.tailwind?.enabled).toBe('auto');
    });

    it('validates unknownBehavior enum', () => {
      expect(
        validateConfigSchema({ unknownBehavior: 'strip' }).config
          ?.unknownBehavior
      ).toBe('strip');
      expect(
        validateConfigSchema({ unknownBehavior: 'invalid' }).valid
      ).toBe(false);
    });

    it('collects all errors instead of failing fast', () => {
      const result = validateConfigSchema({
        framework: 'invalid',
        unknownBehavior: 'invalid',
        remarkPlugins: [123],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('returns undefined config when invalid', () => {
      const result = validateConfigSchema('not an object');
      expect(result.valid).toBe(false);
      expect(result.config).toBeUndefined();
    });
  });
});
