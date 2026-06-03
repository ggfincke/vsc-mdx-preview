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
  it('accepts plain vector markup', () => {
    expect(isSafeIconBody('<path fill="currentColor" d="M3 3h18v18H3z"/>')).toBe(
      true
    );
    expect(isSafeIconBody('<g><circle cx="12" cy="12" r="10"/></g>')).toBe(true);
  });
  it('allows internal fragment refs', () => {
    expect(isSafeIconBody('<rect fill="url(#g)"/><use href="#shape"/>')).toBe(
      true
    );
  });
  it('rejects <image> beacons', () => {
    expect(isSafeIconBody('<image href="https://evil.example/x"/>')).toBe(false);
  });
  it('rejects external href on any element', () => {
    expect(isSafeIconBody('<use xlink:href="https://evil.example/x"/>')).toBe(
      false
    );
  });
  it('rejects protocol-relative & data: hrefs', () => {
    expect(isSafeIconBody('<use href="//evil.example/x"/>')).toBe(false);
    expect(isSafeIconBody('<use href="data:image/svg+xml,x"/>')).toBe(false);
  });
  it('rejects external CSS url() (style attr & <style>), allows safe/internal CSS', () => {
    expect(
      isSafeIconBody('<rect style="mask-image:url(https://evil.example/x)"/>')
    ).toBe(false);
    expect(isSafeIconBody('<rect style="filter:url(//evil.example)"/>')).toBe(
      false
    );
    expect(isSafeIconBody('<style>@import url(https://evil.example)</style>')).toBe(
      false
    );
    expect(isSafeIconBody('<rect style="fill:#fff;stroke:red"/>')).toBe(true);
    expect(isSafeIconBody('<rect fill="url(#grad)"/>')).toBe(true);
  });
  it('rejects <script>, <foreignObject> & <iframe>', () => {
    expect(isSafeIconBody('<script>alert(1)</script>')).toBe(false);
    expect(isSafeIconBody('<foreignObject><b/></foreignObject>')).toBe(false);
    expect(isSafeIconBody('<iframe src="https://evil.example"/>')).toBe(false);
  });
  it('rejects inline event handlers & javascript: urls', () => {
    expect(isSafeIconBody('<path onload="x()"/>')).toBe(false);
    expect(isSafeIconBody('<a href="javascript:alert(1)">x</a>')).toBe(false);
  });
  it('rejects oversized bodies', () => {
    expect(isSafeIconBody('a'.repeat(MAX_BODY_LENGTH + 1))).toBe(false);
  });
});

describe('validateIconifyPack', () => {
  it('returns null for non-objects, arrays & null', () => {
    expect(validateIconifyPack(null)).toBeNull();
    expect(validateIconifyPack('x')).toBeNull();
    expect(validateIconifyPack([])).toBeNull();
    expect(validateIconifyPack({})).toBeNull();
  });
  it('returns null when the icons map is missing or empty', () => {
    expect(validateIconifyPack({ icons: {} })).toBeNull();
    expect(validateIconifyPack({ icons: 'x' })).toBeNull();
  });
  it('normalizes a valid pack & strips unknown fields', () => {
    const out = validateIconifyPack({
      prefix: 'aws',
      width: 24,
      height: 24,
      foo: 'bar',
      icons: { box: { body: '<path d="M0 0"/>', evil: 'x', width: 16 } },
    });
    expect(out).toEqual({
      prefix: 'aws',
      width: 24,
      height: 24,
      icons: { box: { body: '<path d="M0 0"/>', width: 16 } },
    });
  });
  it('drops icons with non-string or unsafe bodies, keeps safe ones', () => {
    const out = validateIconifyPack({
      icons: {
        good: { body: '<path d="M0 0"/>' },
        noBody: { width: 10 },
        beacon: { body: '<image href="https://evil.example/x"/>' },
      },
    });
    expect(Object.keys(out!.icons)).toEqual(['good']);
  });
  it('skips prototype-polluting keys without polluting Object.prototype', () => {
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
  });
  it('returns null when every icon is dropped', () => {
    expect(
      validateIconifyPack({ icons: { a: { body: '<script>x</script>' } } })
    ).toBeNull();
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
  it('rejects packs exceeding the icon-count cap', () => {
    const icons: Record<string, { body: string }> = {};
    for (let i = 0; i <= MAX_ICONS_PER_PACK; i++) {
      icons['i' + i] = { body: '<path/>' };
    }
    expect(validateIconifyPack({ icons })).toBeNull();
  });
});
