// examples/basic/src/my-component.js
// simple button component demonstrating MDX Preview's ability to render custom React components

import React from 'react';

export default function MyComponent() {
  const [count, setCount] = React.useState(0);

  return (
    <button
      onClick={() => setCount(c => c + 1)}
      style={{
        background: '#0066cc',
        color: 'white',
        fontSize: '16px',
        padding: '12px 24px',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
      }}
    >
      Clicked {count} times
    </button>
  );
}
