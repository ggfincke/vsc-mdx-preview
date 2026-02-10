import { describe, expect, it } from 'vitest';
import {
  getCanonicalComponentName,
  getFrameworkComponents,
} from '../src/components/registry/index';

describe('components registry exports', () => {
  it('exposes stable query helpers', () => {
    expect(typeof getCanonicalComponentName).toBe('function');
    expect(typeof getFrameworkComponents).toBe('function');
  });
});
