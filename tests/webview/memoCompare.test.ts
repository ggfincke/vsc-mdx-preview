// tests/webview/memoCompare.test.ts
// Unit tests for memo comparison utility functions

import { describe, it, expect } from 'vitest';
import {
  shallowArrayEquals,
  fastStringEquals,
  createFieldComparator,
} from '../../packages/webview-app/src/utils/memoCompare';

describe('memoCompare utilities', () => {
  describe('shallowArrayEquals()', () => {
    it('should return true for identical arrays', () => {
      const arr = [1, 2, 3];
      expect(shallowArrayEquals(arr, arr)).toBe(true);
    });

    it('should return true for arrays with same values', () => {
      expect(shallowArrayEquals([1, 2, 3], [1, 2, 3])).toBe(true);
    });

    it('should return true for empty arrays', () => {
      expect(shallowArrayEquals([], [])).toBe(true);
    });

    it('should return false for arrays with different lengths', () => {
      expect(shallowArrayEquals([1, 2], [1, 2, 3])).toBe(false);
    });

    it('should return false for arrays with different values', () => {
      expect(shallowArrayEquals([1, 2, 3], [1, 2, 4])).toBe(false);
    });

    it('should return false for arrays with same values in different order', () => {
      expect(shallowArrayEquals([1, 2, 3], [3, 2, 1])).toBe(false);
    });

    it('should use strict equality for objects', () => {
      const obj1 = { a: 1 };
      const obj2 = { a: 1 };
      // Same reference
      expect(shallowArrayEquals([obj1], [obj1])).toBe(true);
      // Different references (same content, but should be false)
      expect(shallowArrayEquals([obj1], [obj2])).toBe(false);
    });

    it('should handle string arrays', () => {
      expect(shallowArrayEquals(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(true);
      expect(shallowArrayEquals(['a', 'b'], ['a', 'c'])).toBe(false);
    });

    it('should short-circuit on first difference', () => {
      // This tests the O(n) behavior - should not iterate through entire array
      const arr1 = [1, 2, 3, 4, 5];
      const arr2 = [0, 2, 3, 4, 5]; // First element differs
      expect(shallowArrayEquals(arr1, arr2)).toBe(false);
    });
  });

  describe('fastStringEquals()', () => {
    it('should return true for identical strings', () => {
      const str = 'hello world';
      expect(fastStringEquals(str, str)).toBe(true);
    });

    it('should return true for equal strings', () => {
      expect(fastStringEquals('hello', 'hello')).toBe(true);
    });

    it('should return true for empty strings', () => {
      expect(fastStringEquals('', '')).toBe(true);
    });

    it('should return false for strings with different lengths', () => {
      expect(fastStringEquals('hello', 'hello world')).toBe(false);
    });

    it('should return false for different strings of same length', () => {
      expect(fastStringEquals('hello', 'hallo')).toBe(false);
    });

    it('should handle large strings efficiently', () => {
      const largeStr1 = 'a'.repeat(100000);
      const largeStr2 = 'a'.repeat(100000);
      const largeStr3 = 'b'.repeat(100000);

      // Same content
      expect(fastStringEquals(largeStr1, largeStr2)).toBe(true);
      // Different content, same length
      expect(fastStringEquals(largeStr1, largeStr3)).toBe(false);
    });

    it('should fast-path on length mismatch', () => {
      // Different lengths should return false in O(1)
      const str1 = 'a'.repeat(100000);
      const str2 = 'a'.repeat(100001);
      expect(fastStringEquals(str1, str2)).toBe(false);
    });
  });

  describe('createFieldComparator()', () => {
    interface TestProps {
      name: string;
      count: number;
      items: string[];
      callback: () => void;
    }

    it('should compare all fields by default (shallow)', () => {
      const comparator = createFieldComparator<TestProps>({});

      const callback = () => {};
      const props1: TestProps = { name: 'a', count: 1, items: ['x'], callback };
      const props2: TestProps = { name: 'a', count: 1, items: ['x'], callback };

      // items are different references
      expect(comparator(props1, props2)).toBe(false);
    });

    it('should skip fields marked as skip', () => {
      const comparator = createFieldComparator<TestProps>({
        callback: 'skip',
        items: 'skip',
      });

      const props1: TestProps = {
        name: 'a',
        count: 1,
        items: ['x'],
        callback: () => {},
      };
      const props2: TestProps = {
        name: 'a',
        count: 1,
        items: ['y'], // Different but skipped
        callback: () => {}, // Different reference but skipped
      };

      expect(comparator(props1, props2)).toBe(true);
    });

    it('should use shallowArrayEquals for array fields', () => {
      const comparator = createFieldComparator<TestProps>({
        items: 'array',
        callback: 'skip',
      });

      const props1: TestProps = {
        name: 'a',
        count: 1,
        items: ['x', 'y'],
        callback: () => {},
      };
      const props2: TestProps = {
        name: 'a',
        count: 1,
        items: ['x', 'y'], // Same values, different reference
        callback: () => {},
      };

      expect(comparator(props1, props2)).toBe(true);
    });

    it('should return false when array field has different values', () => {
      const comparator = createFieldComparator<TestProps>({
        items: 'array',
        callback: 'skip',
      });

      const props1: TestProps = {
        name: 'a',
        count: 1,
        items: ['x', 'y'],
        callback: () => {},
      };
      const props2: TestProps = {
        name: 'a',
        count: 1,
        items: ['x', 'z'], // Different values
        callback: () => {},
      };

      expect(comparator(props1, props2)).toBe(false);
    });

    it('should handle primitive field differences', () => {
      const comparator = createFieldComparator<TestProps>({
        items: 'skip',
        callback: 'skip',
      });

      const props1: TestProps = {
        name: 'a',
        count: 1,
        items: [],
        callback: () => {},
      };
      const props2: TestProps = {
        name: 'b', // Different
        count: 1,
        items: [],
        callback: () => {},
      };

      expect(comparator(props1, props2)).toBe(false);
    });

    it('should handle number field differences', () => {
      const comparator = createFieldComparator<TestProps>({
        items: 'skip',
        callback: 'skip',
      });

      const props1: TestProps = {
        name: 'a',
        count: 1,
        items: [],
        callback: () => {},
      };
      const props2: TestProps = {
        name: 'a',
        count: 2, // Different
        items: [],
        callback: () => {},
      };

      expect(comparator(props1, props2)).toBe(false);
    });

    it('should handle array strategy with non-array value gracefully', () => {
      interface MixedProps {
        data: string | string[];
      }

      const comparator = createFieldComparator<MixedProps>({
        data: 'array',
      });

      // Both strings (not arrays) - should use strict equality
      const props1: MixedProps = { data: 'test' };
      const props2: MixedProps = { data: 'test' };
      expect(comparator(props1, props2)).toBe(true);

      const props3: MixedProps = { data: 'test' };
      const props4: MixedProps = { data: 'other' };
      expect(comparator(props3, props4)).toBe(false);
    });

    it('should return true when all non-skipped fields match', () => {
      const comparator = createFieldComparator<TestProps>({
        items: 'array',
        callback: 'skip',
      });

      const callback1 = () => console.log('a');
      const callback2 = () => console.log('b');

      const props1: TestProps = {
        name: 'test',
        count: 42,
        items: ['a', 'b', 'c'],
        callback: callback1,
      };
      const props2: TestProps = {
        name: 'test',
        count: 42,
        items: ['a', 'b', 'c'],
        callback: callback2, // Different but skipped
      };

      expect(comparator(props1, props2)).toBe(true);
    });
  });
});
