// packages/webview-app/src/utils/memoCompare.ts
// Utilities for React.memo comparison functions

// shallow comparison of two arrays
// O(n) but short-circuits on first difference
export function shallowArrayEquals<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) {return false;}
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {return false;}
  }
  return true;
}

// fast string comparison w/ O(1) length fast-path
// for large strings (100KB+), mismatched length returns false immediately
export function fastStringEquals(a: string, b: string): boolean {
  return a.length === b.length && a === b;
}

// comparison strategy for a field
// - 'shallow': Use === comparison (default for unlisted fields)
// - 'array': Use shallowArrayEquals for array fields
// - 'skip': Ignore this field (useful for stable callbacks)
// - function: Custom comparator (prev, next) => boolean
type FieldStrategy<V> = 'shallow' | 'array' | 'skip' | ((prev: V, next: V) => boolean);

// type for field comparator configuration
type FieldConfig<T> = {
  [K in keyof T]?: FieldStrategy<T[K]>;
};

// creates a field-selective comparison function for React.memo
// param fields - Object mapping field names to comparison strategy
// example:
// const arePropsEqual = createFieldComparator<Props>({
//   dependencies: 'array',
//   onError: 'skip',
//   onSuccess: 'skip',
//   content: (prev, next) => prev.code === next.code && prev.path === next.path,
// });
export function createFieldComparator<T extends object>(
  fields: FieldConfig<T>
): (prev: T, next: T) => boolean {
  return (prev, next) => {
    const allKeys = new Set([
      ...Object.keys(prev),
      ...Object.keys(next),
    ]) as Set<keyof T>;

    for (const key of allKeys) {
      const strategy = fields[key];

      if (strategy === 'skip') {continue;}

      const prevVal = prev[key];
      const nextVal = next[key];

      // custom comparator function
      if (typeof strategy === 'function') {
        if (!strategy(prevVal, nextVal)) {return false;}
        continue;
      }

      if (strategy === 'array') {
        if (!Array.isArray(prevVal) || !Array.isArray(nextVal)) {
          if (prevVal !== nextVal) {return false;}
        } else if (!shallowArrayEquals(prevVal, nextVal)) {
          return false;
        }
      } else {
        // Default shallow comparison
        if (prevVal !== nextVal) {return false;}
      }
    }
    return true;
  };
}
