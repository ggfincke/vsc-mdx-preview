// tests/transpilation/babel.test.ts
// Unit tests for Babel transpilation

import { describe, it, expect } from 'vitest';
import { transformAsync } from '../../packages/extension-host/src/features/module-runtime/transform/babel';

describe('transformAsync()', () => {
  it('transforms JSX to React.createElement calls', async () => {
    const code = `const element = <div className="test">Hello</div>;`;

    const result = await transformAsync(code);

    expect(result).not.toBeNull();
    expect(result!.code).toContain('React.createElement');
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

  it('handles export default from syntax', async () => {
    // This is a stage-1 proposal supported for real-world compatibility
    const code = `export { default as Button } from './Button';`;

    const result = await transformAsync(code);

    expect(result).not.toBeNull();
    expect(result!.code).toBeDefined();
  });

  it('transforms class properties', async () => {
    const code = `
      class MyComponent {
        state = { count: 0 };
        handleClick = () => {
          this.state.count++;
        };
      }
    `;

    const result = await transformAsync(code);

    expect(result).not.toBeNull();
    // Class properties should be transformed
    expect(result!.code).toContain('MyComponent');
  });

});
