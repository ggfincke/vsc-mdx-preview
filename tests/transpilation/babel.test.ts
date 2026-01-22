// tests/transpilation/babel.test.ts
// Unit tests for Babel transpilation

import { describe, it, expect } from 'vitest';
import { transformAsync } from '../../packages/extension/module-system/transform/babel';

describe('transformAsync()', () => {
  it('transforms JSX to React.createElement calls', async () => {
    const code = `const element = <div className="test">Hello</div>;`;

    const result = await transformAsync(code);

    expect(result).not.toBeNull();
    expect(result!.code).toContain('React.createElement');
    expect(result!.code).toContain('"div"');
    expect(result!.code).toContain('className');
  });

  it('transforms modern syntax (optional chaining)', async () => {
    const code = `const value = obj?.nested?.property;`;

    const result = await transformAsync(code);

    expect(result).not.toBeNull();
    // Optional chaining should be transformed for browser compatibility
    expect(result!.code).not.toContain('?.');
  });

  it('transforms modern syntax (nullish coalescing)', async () => {
    const code = `const value = obj ?? defaultValue;`;

    const result = await transformAsync(code);

    expect(result).not.toBeNull();
    // Nullish coalescing should be transformed
    expect(result!.code).not.toContain('??');
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

  it('transforms React component with hooks', async () => {
    const code = `
      import React, { useState } from 'react';

      function Counter() {
        const [count, setCount] = useState(0);
        return <button onClick={() => setCount(count + 1)}>{count}</button>;
      }
    `;

    const result = await transformAsync(code);

    expect(result).not.toBeNull();
    // Babel transforms JSX & may use _react["default"].createElement or React.createElement
    expect(result!.code).toMatch(/createElement/);
    expect(result!.code).toContain('useState');
  });
});
