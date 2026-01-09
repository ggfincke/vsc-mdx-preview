// packages/webview-app/src/test/TrustedPreview.test.tsx
// unit tests for TrustedPreview component (code evaluation & rendering)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TrustedPreviewRenderer } from '../TrustedPreview';
import { LightboxProvider } from '../context/LightboxContext';
import type { TrustedPreviewContent } from '../types';
import type { ComponentType, ReactElement } from 'react';

// mock the module-loader
vi.mock('../module-loader', () => ({
  evaluateModuleToComponent: vi.fn(),
}));

// mock MermaidRenderer to avoid complex diagram rendering in tests
vi.mock('../components/MermaidRenderer', () => ({
  MermaidRenderer: ({ id, code }: { id: string; code: string }) => (
    <div data-testid={`mermaid-${id}`}>{code}</div>
  ),
}));

import { evaluateModuleToComponent } from '../module-loader';

// wrapper component to provide context for tests
function TestWrapper({ children }: { children: ReactElement }) {
  return <LightboxProvider>{children}</LightboxProvider>;
}

// helper to create mock content
function createMockContent(
  overrides: Partial<Omit<TrustedPreviewContent, 'mode'>> = {}
): TrustedPreviewContent {
  return {
    mode: 'trusted',
    code: 'export default function MDXContent() { return null; }',
    entryFilePath: '/projects/test/README.mdx',
    dependencies: [],
    ...overrides,
  };
}

// simple test component for successful evaluation
const TestComponent: ComponentType = () => (
  <div data-testid="mdx-content">Hello from MDX</div>
);

describe('TrustedPreviewRenderer', () => {
  let onComponentReady: ReturnType<typeof vi.fn>;
  let onError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onComponentReady = vi.fn();
    onError = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  describe('loading state', () => {
    it('shows loading spinner initially', async () => {
      // make evaluateModuleToComponent never resolve
      vi.mocked(evaluateModuleToComponent).mockImplementation(
        () => new Promise(() => {})
      );

      render(
        <TestWrapper>
          <TrustedPreviewRenderer
            content={createMockContent()}
            evaluatedComponent={null}
            onComponentReady={onComponentReady}
            onError={onError}
          />
        </TestWrapper>
      );

      expect(
        document.querySelector('.mdx-loading-spinner')
      ).toBeInTheDocument();
    });

    it('shows "Evaluating..." text during evaluation', async () => {
      vi.mocked(evaluateModuleToComponent).mockImplementation(
        () => new Promise(() => {})
      );

      render(
        <TestWrapper>
          <TrustedPreviewRenderer
            content={createMockContent()}
            evaluatedComponent={null}
            onComponentReady={onComponentReady}
            onError={onError}
          />
        </TestWrapper>
      );

      expect(screen.getByText('Evaluating...')).toBeInTheDocument();
    });
  });

  describe('successful evaluation', () => {
    it('renders evaluated component when ready', async () => {
      vi.mocked(evaluateModuleToComponent).mockResolvedValue(TestComponent);

      const { rerender } = render(
        <TestWrapper>
          <TrustedPreviewRenderer
            content={createMockContent()}
            evaluatedComponent={null}
            onComponentReady={onComponentReady}
            onError={onError}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(onComponentReady).toHaveBeenCalledWith(TestComponent);
      });

      // rerender w/ the evaluated component (simulates parent updating state)
      rerender(
        <TestWrapper>
          <TrustedPreviewRenderer
            content={createMockContent()}
            evaluatedComponent={TestComponent}
            onComponentReady={onComponentReady}
            onError={onError}
          />
        </TestWrapper>
      );

      // wait for loading to complete
      await waitFor(() => {
        expect(
          document.querySelector('.mdx-loading-spinner')
        ).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('mdx-content')).toBeInTheDocument();
      expect(screen.getByText('Hello from MDX')).toBeInTheDocument();
    });

    it('calls onComponentReady with component reference', async () => {
      vi.mocked(evaluateModuleToComponent).mockResolvedValue(TestComponent);

      render(
        <TestWrapper>
          <TrustedPreviewRenderer
            content={createMockContent()}
            evaluatedComponent={null}
            onComponentReady={onComponentReady}
            onError={onError}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(onComponentReady).toHaveBeenCalledTimes(1);
        expect(onComponentReady).toHaveBeenCalledWith(TestComponent);
      });
    });

    it('passes correct arguments to evaluateModuleToComponent', async () => {
      vi.mocked(evaluateModuleToComponent).mockResolvedValue(TestComponent);

      const content = createMockContent({
        code: 'test code',
        entryFilePath: '/test/path.mdx',
        dependencies: ['react', 'lodash'],
      });

      render(
        <TestWrapper>
          <TrustedPreviewRenderer
            content={content}
            evaluatedComponent={null}
            onComponentReady={onComponentReady}
            onError={onError}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(evaluateModuleToComponent).toHaveBeenCalledWith(
          'test code',
          '/test/path.mdx',
          ['react', 'lodash']
        );
      });
    });
  });

  describe('error handling', () => {
    it('calls onError when evaluation throws Error', async () => {
      const testError = new Error('Module evaluation failed');
      testError.stack = 'Error: Module evaluation failed\n    at test.js:1:1';
      vi.mocked(evaluateModuleToComponent).mockRejectedValue(testError);

      render(
        <TestWrapper>
          <TrustedPreviewRenderer
            content={createMockContent()}
            evaluatedComponent={null}
            onComponentReady={onComponentReady}
            onError={onError}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith({
          message: 'Module evaluation failed',
          stack: 'Error: Module evaluation failed\n    at test.js:1:1',
        });
      });
    });

    it('handles non-Error throws (string)', async () => {
      vi.mocked(evaluateModuleToComponent).mockRejectedValue(
        'Something went wrong'
      );

      render(
        <TestWrapper>
          <TrustedPreviewRenderer
            content={createMockContent()}
            evaluatedComponent={null}
            onComponentReady={onComponentReady}
            onError={onError}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith({
          message: 'Something went wrong',
          stack: undefined,
        });
      });
    });

    it('handles non-Error throws (object)', async () => {
      vi.mocked(evaluateModuleToComponent).mockRejectedValue({
        custom: 'error object',
      });

      render(
        <TestWrapper>
          <TrustedPreviewRenderer
            content={createMockContent()}
            evaluatedComponent={null}
            onComponentReady={onComponentReady}
            onError={onError}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith({
          message: '[object Object]',
          stack: undefined,
        });
      });
    });
  });

  describe('re-evaluation on content change', () => {
    it('re-evaluates when code changes', async () => {
      vi.mocked(evaluateModuleToComponent).mockResolvedValue(TestComponent);

      const { rerender } = render(
        <TestWrapper>
          <TrustedPreviewRenderer
            content={createMockContent({ code: 'code v1' })}
            evaluatedComponent={null}
            onComponentReady={onComponentReady}
            onError={onError}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(evaluateModuleToComponent).toHaveBeenCalledTimes(1);
      });

      // change the code
      rerender(
        <TestWrapper>
          <TrustedPreviewRenderer
            content={createMockContent({ code: 'code v2' })}
            evaluatedComponent={null}
            onComponentReady={onComponentReady}
            onError={onError}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(evaluateModuleToComponent).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('cancellation', () => {
    it('ignores evaluation result if unmounted during async', async () => {
      let resolveEvaluation: (component: ComponentType) => void;
      vi.mocked(evaluateModuleToComponent).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveEvaluation = resolve;
          })
      );

      const { unmount } = render(
        <TestWrapper>
          <TrustedPreviewRenderer
            content={createMockContent()}
            evaluatedComponent={null}
            onComponentReady={onComponentReady}
            onError={onError}
          />
        </TestWrapper>
      );

      // unmount before evaluation completes
      unmount();

      // resolve after unmount
      await act(async () => {
        resolveEvaluation!(TestComponent);
      });

      // onComponentReady should not be called after unmount
      expect(onComponentReady).not.toHaveBeenCalled();
    });
  });

  describe('container attributes', () => {
    it('renders with correct class and data-mode', async () => {
      vi.mocked(evaluateModuleToComponent).mockResolvedValue(TestComponent);

      render(
        <TestWrapper>
          <TrustedPreviewRenderer
            content={createMockContent()}
            evaluatedComponent={TestComponent}
            onComponentReady={onComponentReady}
            onError={onError}
          />
        </TestWrapper>
      );

      // wait for loading to complete
      await waitFor(() => {
        expect(
          document.querySelector('.mdx-loading-spinner')
        ).not.toBeInTheDocument();
      });

      const container = document.querySelector('.mdx-trusted-preview');
      expect(container).toBeInTheDocument();
      expect(container).toHaveAttribute('data-mode', 'trusted');
    });
  });

  describe('Mermaid integration', () => {
    it('scans for mermaid containers after render', async () => {
      // component that renders mermaid placeholder
      const ComponentWithMermaid: ComponentType = () => (
        <div>
          <pre data-mermaid-chart="true" data-mermaid-id="test-diagram">
            <code data-mermaid-code="graph TD; A-->B;">
              graph TD; A--&gt;B;
            </code>
          </pre>
        </div>
      );

      vi.mocked(evaluateModuleToComponent).mockResolvedValue(
        ComponentWithMermaid
      );

      render(
        <TestWrapper>
          <TrustedPreviewRenderer
            content={createMockContent()}
            evaluatedComponent={ComponentWithMermaid}
            onComponentReady={onComponentReady}
            onError={onError}
          />
        </TestWrapper>
      );

      // mermaid container should be present
      await waitFor(() => {
        const mermaidPlaceholder = document.querySelector(
          '[data-mermaid-chart]'
        );
        expect(mermaidPlaceholder).toBeInTheDocument();
      });
    });
  });
});
