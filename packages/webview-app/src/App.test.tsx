// packages/webview-app/src/App.test.tsx
// unit tests for main App component

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import App from './App';

// mock the RPC module
vi.mock('./rpc-webview', () => ({
  registerWebviewHandlers: vi.fn(),
}));

describe('App', () => {
  it('renders without crashing', () => {
    const { container } = render(<App />);
    expect(container).toBeTruthy();
  });
});
