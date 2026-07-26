// tests/transpilation/babel.test.ts
// Unit tests for Babel transpilation

import { describe, it, expect } from 'vitest';
import { transformAsync } from '../../packages/extension-host/src/features/module-runtime/transform/babel';

describe('transformAsync()', () => {
  it('transforms JSX via the automatic runtime (BH-MR-2)', async () => {
    const code = `const element = <div className="test">Hello</div>;`;

    const result = await transformAsync(code);

    expect(result).not.toBeNull();
    // automatic runtime: jsx() calls from react/jsx-runtime, no React global
    expect(result!.code).toContain('react/jsx-runtime');
    expect(result!.code).not.toContain('React.createElement');
    expect(result!.code).toContain('"div"');
    expect(result!.code).toContain('className');
  });

  it('preserves modern syntax (optional chaining) - native in Node 20/Chromium', async () => {
    const code = `const value = obj?.nested?.property;`;

    const result = await transformAsync(code);

    expect(result).not.toBeNull();
    // Optional chaining is natively supported in Node 20 & modern Chromium
    // so it should be preserved (not transformed)
    expect(result!.code).toContain('?.');
  });

});
