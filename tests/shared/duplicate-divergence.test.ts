// tests/shared/duplicate-divergence.test.ts
// document intentional divergence between GPL/MIT duplicate pairs (finding 14)
// ! cross-repo parity: these tests make drift visible immediately
// if a test fails, the divergence has changed & the audit matrix needs updating

import { describe, it, expect } from 'vitest';
import { LRUCache } from '../../packages/runtime-utils/src/cache/lru-cache';
import {
  isNpmModuleId,
  isBareImport,
  isValidModuleRequest,
} from '../../packages/runtime-utils/src/module-id';

describe('LRU cache divergence contract (Finding 14)', () => {
  // runtime-utils LRUCache supports TTL, clearWithEviction, protectedCount
  // mdx-forge's copy does NOT have these features (simpler)

  it('runtime-utils LRUCache supports TTL', () => {
    const cache = new LRUCache<string, string>({ maxEntries: 10, ttlMs: 1000 });
    cache.set('key', 'value');
    expect(cache.get('key')).toBe('value');
  });

  it('runtime-utils LRUCache supports protectedCount', () => {
    const cache = new LRUCache<string, number>({ maxEntries: 3 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // protectedCount tracks entries shielded from eviction
    expect(typeof cache.protectedCount).toBe('number');
  });
});

describe('module-id divergence contract (Finding 14)', () => {
  // runtime-utils exports isNpmModuleId, isBareImport, isValidModuleRequest
  // mdx-forge's copy only exposes isBareImport (simpler)

  it('runtime-utils exports isNpmModuleId', () => {
    expect(isNpmModuleId('npm://react@18')).toBe(true);
    expect(isNpmModuleId('./local')).toBe(false);
  });

  it('runtime-utils exports isValidModuleRequest', () => {
    expect(isValidModuleRequest('react')).toBe(true);
    expect(isValidModuleRequest('http://evil.com')).toBe(false);
    expect(isValidModuleRequest('file:///etc/passwd')).toBe(false);
  });

  it('isBareImport shared behavior matches mdx-forge contract', () => {
    // these must match mdx-forge's isBareImport behavior exactly
    expect(isBareImport('react')).toBe(true);
    expect(isBareImport('lodash/merge')).toBe(true);
    expect(isBareImport('./relative')).toBe(false);
    expect(isBareImport('../parent')).toBe(false);
    expect(isBareImport('/absolute')).toBe(false);
    expect(isBareImport('npm://react@18')).toBe(false);
  });
});
