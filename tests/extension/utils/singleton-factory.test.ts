// tests/extension/utils/singleton-factory.test.ts
// unit tests for singleton factory w/ disposal support

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSingleton,
  createResettableSingleton,
} from '../../../packages/extension/utils/singleton-factory';

describe('singleton-factory', () => {
  describe('createSingleton', () => {
    it('creates instance lazily on first get()', () => {
      const factory = vi.fn(() => ({ value: 42 }));
      const singleton = createSingleton(factory);

      expect(factory).not.toHaveBeenCalled();
      const instance = singleton.get();
      expect(factory).toHaveBeenCalledTimes(1);
      expect(instance.value).toBe(42);
    });

    it('returns same instance on subsequent get() calls', () => {
      const factory = vi.fn(() => ({ value: 42 }));
      const singleton = createSingleton(factory);

      const first = singleton.get();
      const second = singleton.get();
      const third = singleton.get();

      expect(factory).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
      expect(second).toBe(third);
    });

    it('reset() is no-op when resettable is false or undefined', () => {
      const factory = vi.fn(() => ({ value: 42 }));
      const singleton = createSingleton(factory);

      const first = singleton.get();
      singleton.reset();
      const second = singleton.get();

      expect(factory).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
    });

    it('reset() is no-op when resettable is explicitly false', () => {
      const factory = vi.fn(() => ({ value: 42 }));
      const singleton = createSingleton(factory, { resettable: false });

      const first = singleton.get();
      singleton.reset();
      const second = singleton.get();

      expect(factory).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
    });

    it('dispose() clears instance & calls dispose callback', () => {
      const disposeCallback = vi.fn();
      const factory = vi.fn(() => ({ value: 42 }));
      const singleton = createSingleton(factory, { dispose: disposeCallback });

      const first = singleton.get();
      expect(disposeCallback).not.toHaveBeenCalled();

      singleton.dispose();
      expect(disposeCallback).toHaveBeenCalledTimes(1);
      expect(disposeCallback).toHaveBeenCalledWith(first);

      // next get() creates new instance
      const second = singleton.get();
      expect(factory).toHaveBeenCalledTimes(2);
      expect(second).not.toBe(first);
    });

    it('dispose() is no-op when instance is null', () => {
      const disposeCallback = vi.fn();
      const factory = vi.fn(() => ({ value: 42 }));
      const singleton = createSingleton(factory, { dispose: disposeCallback });

      // dispose before any get()
      singleton.dispose();
      expect(disposeCallback).not.toHaveBeenCalled();
    });

    it('dispose() clears instance even without dispose callback', () => {
      const factory = vi.fn(() => ({ value: 42 }));
      const singleton = createSingleton(factory);

      const first = singleton.get();
      singleton.dispose();
      const second = singleton.get();

      expect(factory).toHaveBeenCalledTimes(2);
      expect(second).not.toBe(first);
    });
  });

  describe('createResettableSingleton', () => {
    it('reset() clears instance & creates new on next get()', () => {
      const factory = vi.fn(() => ({ value: 42 }));
      const singleton = createResettableSingleton(factory);

      const first = singleton.get();
      singleton.reset();
      const second = singleton.get();

      expect(factory).toHaveBeenCalledTimes(2);
      expect(first).not.toBe(second);
    });

    it('reset() calls dispose callback when configured', () => {
      const disposeCallback = vi.fn();
      const factory = vi.fn(() => ({ value: 42 }));
      const singleton = createResettableSingleton(factory, { dispose: disposeCallback });

      const first = singleton.get();
      singleton.reset();

      expect(disposeCallback).toHaveBeenCalledTimes(1);
      expect(disposeCallback).toHaveBeenCalledWith(first);
    });

    it('reset() is no-op when instance is null', () => {
      const disposeCallback = vi.fn();
      const factory = vi.fn(() => ({ value: 42 }));
      const singleton = createResettableSingleton(factory, { dispose: disposeCallback });

      // reset before any get()
      singleton.reset();
      expect(disposeCallback).not.toHaveBeenCalled();
      expect(factory).not.toHaveBeenCalled();
    });

    it('dispose() also works on resettable singletons', () => {
      const disposeCallback = vi.fn();
      const factory = vi.fn(() => ({ value: 42 }));
      const singleton = createResettableSingleton(factory, { dispose: disposeCallback });

      const first = singleton.get();
      singleton.dispose();

      expect(disposeCallback).toHaveBeenCalledTimes(1);
      expect(disposeCallback).toHaveBeenCalledWith(first);

      // verify instance is cleared
      const second = singleton.get();
      expect(factory).toHaveBeenCalledTimes(2);
      expect(second).not.toBe(first);
    });
  });

  describe('disposal with typed instances', () => {
    interface Disposable {
      dispose: () => void;
    }

    it('works with objects that have dispose methods', () => {
      const innerDispose = vi.fn();
      const factory = vi.fn(() => ({
        value: 42,
        dispose: innerDispose,
      }));

      const singleton = createSingleton(factory, {
        dispose: (instance) => instance.dispose(),
      });

      const instance = singleton.get();
      singleton.dispose();

      expect(innerDispose).toHaveBeenCalledTimes(1);
    });

    it('allows conditional disposal based on instance type', () => {
      const innerDispose = vi.fn();
      const factory = vi.fn(() => ({
        value: 42,
        dispose: innerDispose,
      }));

      const singleton = createSingleton<{ value: number; dispose?: () => void }>(factory, {
        dispose: (instance) => instance.dispose?.(),
      });

      const instance = singleton.get();
      singleton.dispose();

      expect(innerDispose).toHaveBeenCalledTimes(1);
    });
  });
});
