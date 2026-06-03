// tests/extension/themes/iconPackValidation.test.ts
// verify untrusted icon pack JSON is validated, narrowed & body-sanitized

import { describe, it, expect } from 'vitest';
import {
  validateIconifyPack,
  isSafeIconBody,
  MAX_BODY_LENGTH,
  MAX_ICONS_PER_PACK,
} from '../../../packages/extension-host/src/features/themes/iconPackValidation';

describe('isSafeIconBody', () => {
  it('accepts plain vector markup & internal fragment refs', () => {
    expect(
      isSafeIconBody('<path fill="currentColor" d="M3 3h18v18H3z"/>')
    ).toBe(true);
    expect(isSafeIconBody('<g><circle cx="12" cy="12" r="10"/></g>')).toBe(
      true
    );
    expect(isSafeIconBody('<rect fill="url(#g)"/><use href="#shape"/>')).toBe(
      true
    );
    expect(isSafeIconBody('<rect style="fill:#fff;stroke:red"/>')).toBe(true);
  });

  it('rejects external-resource, script & oversized bodies', () => {
    expect(isSafeIconBody('<image href="https://evil.example/x"/>')).toBe(
      false
    );
    expect(isSafeIconBody('<use xlink:href="https://evil.example/x"/>')).toBe(
      false
    );
    expect(isSafeIconBody('<use href="//evil.example/x"/>')).toBe(false);
    expect(isSafeIconBody('<use href="data:image/svg+xml,x"/>')).toBe(false);
    expect(
      isSafeIconBody('<rect style="mask-image:url(https://evil.example/x)"/>')
    ).toBe(false);
    expect(isSafeIconBody('<rect style="filter:url(//evil.example)"/>')).toBe(
      false
    );
    expect(
      isSafeIconBody('<style>@import url(https://evil.example)</style>')
    ).toBe(false);
    expect(isSafeIconBody('<script>alert(1)</script>')).toBe(false);
    expect(isSafeIconBody('<foreignObject><b/></foreignObject>')).toBe(false);
    expect(isSafeIconBody('<iframe src="https://evil.example"/>')).toBe(false);
    expect(isSafeIconBody('<path onload="x()"/>')).toBe(false);
    expect(isSafeIconBody('<a href="javascript:alert(1)">x</a>')).toBe(false);
    expect(isSafeIconBody('a'.repeat(MAX_BODY_LENGTH + 1))).toBe(false);
  });
});

describe('validateIconifyPack', () => {
  it('rejects non-pack inputs & packs that yield no usable icons', () => {
    expect(validateIconifyPack(null)).toBeNull();
    expect(validateIconifyPack('x')).toBeNull();
    expect(validateIconifyPack([])).toBeNull();
    expect(validateIconifyPack({})).toBeNull();
    expect(validateIconifyPack({ icons: {} })).toBeNull();
    expect(validateIconifyPack({ icons: 'x' })).toBeNull();
    expect(
      validateIconifyPack({ icons: { a: { body: '<script>x</script>' } } })
    ).toBeNull();
  });

  it('narrows a valid pack: strips unknown fields & drops unsafe icons', () => {
    expect(
      validateIconifyPack({
        prefix: 'aws',
        width: 24,
        height: 24,
        foo: 'bar',
        icons: { box: { body: '<path d="M0 0"/>', evil: 'x', width: 16 } },
      })
    ).toEqual({
      prefix: 'aws',
      width: 24,
      height: 24,
      icons: { box: { body: '<path d="M0 0"/>', width: 16 } },
    });
    const mixed = validateIconifyPack({
      icons: {
        good: { body: '<path d="M0 0"/>' },
        noBody: { width: 10 },
        beacon: { body: '<image href="https://evil.example/x"/>' },
      },
    });
    expect(Object.keys(mixed!.icons)).toEqual(['good']);
  });

  it('preserves geometry & flip transforms', () => {
    const out = validateIconifyPack({
      icons: {
        i: {
          body: '<path/>',
          width: 1,
          height: 2,
          left: 3,
          top: 4,
          rotate: 1,
          hFlip: true,
          vFlip: false,
        },
      },
    });
    expect(out!.icons.i).toEqual({
      body: '<path/>',
      width: 1,
      height: 2,
      left: 3,
      top: 4,
      rotate: 1,
      hFlip: true,
      vFlip: false,
    });
  });

  it('blocks prototype pollution & enforces the icon-count cap', () => {
    const out = validateIconifyPack(
      JSON.parse(
        '{"icons":{"__proto__":{"body":"<path/>"},"constructor":{"body":"<path/>"},"ok":{"body":"<path/>"}}}'
      )
    );
    expect(Object.keys(out!.icons)).toEqual(['ok']);
    expect(Object.prototype.hasOwnProperty.call(out!.icons, '__proto__')).toBe(
      false
    );
    expect(({} as Record<string, unknown>).body).toBeUndefined();

    const many: Record<string, { body: string }> = {};
    for (let i = 0; i <= MAX_ICONS_PER_PACK; i++) {
      many['i' + i] = { body: '<path/>' };
    }
    expect(validateIconifyPack({ icons: many })).toBeNull();
  });
});
