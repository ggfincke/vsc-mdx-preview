import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TailwindCache } from '../tailwind';

vi.mock('../logging', () => ({
  debug: vi.fn(),
}));

describe('TailwindCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic operations', () => {
    it('should store and retrieve a value', () => {
      const cache = new TailwindCache();
      cache.set('key1', '.flex { display: flex; }');
      expect(cache.get('key1')).toBe('.flex { display: flex; }');
    });

    it('should return null for non-existent key', () => {
      const cache = new TailwindCache();
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should clear all entries', () => {
      const cache = new TailwindCache();
      cache.set('key1', 'css1');
      cache.set('key2', 'css2');
      cache.clear();
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });

    it('should update value when setting same key', () => {
      const cache = new TailwindCache();
      cache.set('key1', 'old-css');
      cache.set('key1', 'new-css');
      expect(cache.get('key1')).toBe('new-css');
    });
  });

  describe('TTL expiration', () => {
    it('should return value before TTL expires', () => {
      const cache = new TailwindCache({ ttlMs: 5 * 60 * 1000 }); // 5 minutes
      cache.set('key1', 'css');

      // Advance 4 minutes (before TTL)
      vi.advanceTimersByTime(4 * 60 * 1000);
      expect(cache.get('key1')).toBe('css');
    });

    it('should return null after TTL expires', () => {
      const cache = new TailwindCache({ ttlMs: 5 * 60 * 1000 }); // 5 minutes
      cache.set('key1', 'css');

      // Advance 6 minutes (after TTL)
      vi.advanceTimersByTime(6 * 60 * 1000);
      expect(cache.get('key1')).toBeNull();
    });

    it('should delete expired entry on access (lazy cleanup)', () => {
      const cache = new TailwindCache({ ttlMs: 1000 });
      cache.set('key1', 'css');

      vi.advanceTimersByTime(2000);

      // first access should delete & return null
      expect(cache.get('key1')).toBeNull();
      // Second access also returns null (entry was deleted)
      expect(cache.get('key1')).toBeNull();
    });

    it('should reset TTL when setting same key again', () => {
      const cache = new TailwindCache({ ttlMs: 5 * 60 * 1000 });
      cache.set('key1', 'css');

      // Advance 4 minutes
      vi.advanceTimersByTime(4 * 60 * 1000);

      // Re-set the key (resets TTL)
      cache.set('key1', 'css');

      // Advance another 4 minutes (8 total from start, but only 4 from re-set)
      vi.advanceTimersByTime(4 * 60 * 1000);

      // Should still be valid since TTL was reset
      expect(cache.get('key1')).toBe('css');
    });

    it('should expire immediately with zero TTL', () => {
      const cache = new TailwindCache({ ttlMs: 0 });
      cache.set('key1', 'css');

      // Advance just 1ms
      vi.advanceTimersByTime(1);
      expect(cache.get('key1')).toBeNull();
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entry when max exceeded', () => {
      const cache = new TailwindCache({ maxEntries: 2 });
      cache.set('key1', 'css1');
      cache.set('key2', 'css2');
      cache.set('key3', 'css3'); // Should evict key1

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBe('css2');
      expect(cache.get('key3')).toBe('css3');
    });

    it('should refresh LRU position on access', () => {
      const cache = new TailwindCache({ maxEntries: 2 });
      cache.set('key1', 'css1');
      cache.set('key2', 'css2');

      // Access key1 to refresh its position
      cache.get('key1');

      // Add key3 - should evict key2 (now oldest)
      cache.set('key3', 'css3');

      expect(cache.get('key1')).toBe('css1'); // Still present
      expect(cache.get('key2')).toBeNull(); // Evicted
      expect(cache.get('key3')).toBe('css3');
    });

    it('should keep most recently accessed entry during eviction', () => {
      const cache = new TailwindCache({ maxEntries: 3 });
      cache.set('key1', 'css1');
      cache.set('key2', 'css2');
      cache.set('key3', 'css3');

      // Access key1 to make it most recent
      cache.get('key1');

      // Add two more entries
      cache.set('key4', 'css4');
      cache.set('key5', 'css5');

      // key2 & key3 should be evicted, key1 kept
      expect(cache.get('key1')).toBe('css1');
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')).toBeNull();
      expect(cache.get('key4')).toBe('css4');
      expect(cache.get('key5')).toBe('css5');
    });

    it('should handle maxEntries of 1', () => {
      const cache = new TailwindCache({ maxEntries: 1 });
      cache.set('key1', 'css1');
      cache.set('key2', 'css2');

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBe('css2');
    });
  });

  describe('updateSettings', () => {
    it('should trigger immediate eviction when reducing maxEntries', () => {
      const cache = new TailwindCache({ maxEntries: 5 });
      cache.set('key1', 'css1');
      cache.set('key2', 'css2');
      cache.set('key3', 'css3');

      // Reduce maxEntries to 1
      cache.updateSettings({ maxEntries: 1 });

      // Only the most recent entry should remain
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')).toBe('css3');
    });

    it('should not evict when increasing maxEntries', () => {
      const cache = new TailwindCache({ maxEntries: 2 });
      cache.set('key1', 'css1');
      cache.set('key2', 'css2');

      cache.updateSettings({ maxEntries: 10 });

      expect(cache.get('key1')).toBe('css1');
      expect(cache.get('key2')).toBe('css2');
    });

    it('should apply new TTL to future entries only', () => {
      const cache = new TailwindCache({ ttlMs: 5 * 60 * 1000 });
      cache.set('key1', 'css1');

      // Change TTL to 1 minute
      cache.updateSettings({ ttlMs: 1 * 60 * 1000 });

      // add new entry w/ new TTL
      cache.set('key2', 'css2');

      // Advance 2 minutes
      vi.advanceTimersByTime(2 * 60 * 1000);

      // key1 (5min TTL) should still be valid
      expect(cache.get('key1')).toBe('css1');
      // key2 (1min TTL) should be expired
      expect(cache.get('key2')).toBeNull();
    });

    it('should not trigger update when settings are unchanged', () => {
      const cache = new TailwindCache({ maxEntries: 5, ttlMs: 60000 });
      cache.set('key1', 'css1');
      cache.set('key2', 'css2');

      // call updateSettings w/ same values
      cache.updateSettings({ maxEntries: 5, ttlMs: 60000 });

      // Entries should still exist
      expect(cache.get('key1')).toBe('css1');
      expect(cache.get('key2')).toBe('css2');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string CSS', () => {
      const cache = new TailwindCache();
      cache.set('key1', '');
      expect(cache.get('key1')).toBe('');
    });

    it('should handle very long CSS strings', () => {
      const cache = new TailwindCache();
      const longCss = '.a { color: red; }'.repeat(10000);
      cache.set('key1', longCss);
      expect(cache.get('key1')).toBe(longCss);
    });

    it('should handle special characters in key', () => {
      const cache = new TailwindCache();
      const specialKey = 'v4:flex gap-2:config=/path/to/config.js';
      cache.set(specialKey, 'css');
      expect(cache.get(specialKey)).toBe('css');
    });

    it('should use default values when no options provided', () => {
      const cache = new TailwindCache();
      // fill w/ 20 entries (default maxEntries)
      for (let i = 0; i < 20; i++) {
        cache.set(`key${i}`, `css${i}`);
      }

      // 21st entry should evict oldest (key0)
      cache.set('key20', 'css20');
      expect(cache.get('key0')).toBeNull();

      // key1 should still be present (was second oldest)
      expect(cache.get('key1')).toBe('css1');
      expect(cache.get('key19')).toBe('css19');
      expect(cache.get('key20')).toBe('css20');
    });
  });
});
