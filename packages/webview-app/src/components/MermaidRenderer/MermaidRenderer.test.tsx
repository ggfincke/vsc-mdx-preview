// packages/webview-app/src/components/MermaidRenderer/MermaidRenderer.test.tsx
// unit tests for MermaidRenderer component

import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  vi,
  type Mock,
} from 'vitest';
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import { MermaidRenderer } from './MermaidRenderer';
import { ThemeProvider } from '../../context/ThemeContext';

// mock mermaid library
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(),
  },
}));

// mock theme utils to control theme state
vi.mock('../../utils/theme', () => ({
  getCurrentTheme: vi.fn(() => 'light'),
  onThemeChange: vi.fn(() => () => {}),
}));

// helper to render w/ theme provider
function renderWithTheme(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('MermaidRenderer', () => {
  let mockMermaid: { default: { initialize: Mock; render: Mock } };

  beforeEach(async () => {
    cleanup();
    vi.clearAllMocks();
    mockMermaid = (await import('mermaid')) as unknown as typeof mockMermaid;
  });

  afterEach(() => {
    cleanup();
  });

  describe('container ref availability', () => {
    test('container div is always mounted (fixes ref deadlock)', async () => {
      // set up mermaid to delay slightly (simulating async load)
      mockMermaid.default.render.mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 10));
        return { svg: '<svg>diagram</svg>' };
      });

      const { container } = renderWithTheme(
        <MermaidRenderer code="flowchart TD" id="test-1" />
      );

      // container div should exist immediately, even while loading
      const diagramDiv = container.querySelector('.mermaid-diagram');
      expect(diagramDiv).toBeInTheDocument();
    });

    test('container is hidden while loading', () => {
      mockMermaid.default.render.mockImplementation(
        // never resolves
        () => new Promise(() => {})
      );

      const { container } = renderWithTheme(
        <MermaidRenderer code="flowchart TD" id="test-2" />
      );

      const diagramDiv = container.querySelector('.mermaid-diagram');
      expect(diagramDiv).toHaveStyle({ visibility: 'hidden' });
    });

    test('container becomes visible after render completes', async () => {
      mockMermaid.default.render.mockResolvedValue({
        svg: '<svg>diagram</svg>',
      });

      const { container } = renderWithTheme(
        <MermaidRenderer code="flowchart TD" id="test-3" />
      );

      await waitFor(() => {
        const diagramDiv = container.querySelector('.mermaid-diagram');
        expect(diagramDiv).toHaveStyle({ visibility: 'visible' });
      });
    });
  });

  describe('loading state', () => {
    test('shows loading overlay initially', () => {
      mockMermaid.default.render.mockImplementation(
        // never resolves
        () => new Promise(() => {})
      );

      renderWithTheme(<MermaidRenderer code="flowchart TD" id="test-4" />);

      expect(screen.getByText('Loading diagram...')).toBeInTheDocument();
      expect(
        document.querySelector('.mermaid-loading-spinner')
      ).toBeInTheDocument();
    });

    test('hides loading overlay after render completes', async () => {
      mockMermaid.default.render.mockResolvedValue({
        svg: '<svg>diagram</svg>',
      });

      renderWithTheme(<MermaidRenderer code="flowchart TD" id="test-5" />);

      await waitFor(() => {
        expect(
          screen.queryByText('Loading diagram...')
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('successful render', () => {
    test('renders SVG from mermaid into container', async () => {
      const testSvg = '<svg data-testid="mermaid-svg">test diagram</svg>';
      mockMermaid.default.render.mockResolvedValue({ svg: testSvg });

      const { container } = renderWithTheme(
        <MermaidRenderer code="flowchart TD" id="test-6" />
      );

      await waitFor(() => {
        const diagramDiv = container.querySelector('.mermaid-diagram');
        expect(diagramDiv?.innerHTML).toContain('data-testid="mermaid-svg"');
      });
    });

    test('calls mermaid.render with correct id and code', async () => {
      mockMermaid.default.render.mockResolvedValue({ svg: '<svg></svg>' });
      const testCode = 'sequenceDiagram\nA->>B: Hello';

      renderWithTheme(<MermaidRenderer code={testCode} id="test-7" />);

      await waitFor(() => {
        expect(mockMermaid.default.render).toHaveBeenCalledWith(
          'mermaid-svg-test-7',
          testCode
        );
      });
    });
  });

  describe('error state', () => {
    test('shows error message on render failure', async () => {
      mockMermaid.default.render.mockRejectedValue(new Error('Invalid syntax'));

      renderWithTheme(<MermaidRenderer code="invalid" id="test-8" />);

      await waitFor(() => {
        expect(
          screen.getByText(/Mermaid parse error: Invalid syntax/)
        ).toBeInTheDocument();
      });
    });

    test('shows error icon', async () => {
      mockMermaid.default.render.mockRejectedValue(new Error('Parse error'));

      const { container } = renderWithTheme(
        <MermaidRenderer code="bad" id="test-9" />
      );

      await waitFor(() => {
        expect(
          container.querySelector('.mermaid-error-icon')
        ).toBeInTheDocument();
      });
    });

    test('source toggle button is present in error state', async () => {
      mockMermaid.default.render.mockRejectedValue(new Error('Error'));

      renderWithTheme(<MermaidRenderer code="bad code" id="test-10" />);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /show source/i })
        ).toBeInTheDocument();
      });
    });

    test('clicking toggle shows source code', async () => {
      mockMermaid.default.render.mockRejectedValue(new Error('Error'));
      const testCode = 'flowchart TD\nA-->B';

      renderWithTheme(<MermaidRenderer code={testCode} id="test-11" />);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /show source/i })
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /show source/i }));

      // source is rendered as text w/ newlines preserved
      const codeEl = document.querySelector('.mermaid-source code');
      expect(codeEl?.textContent).toBe(testCode);
    });

    test('clicking toggle again hides source code', async () => {
      mockMermaid.default.render.mockRejectedValue(new Error('Error'));

      renderWithTheme(<MermaidRenderer code="test code" id="test-12" />);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /show source/i })
        ).toBeInTheDocument();
      });

      // show source
      fireEvent.click(screen.getByRole('button', { name: /show source/i }));
      expect(screen.getByText('test code')).toBeInTheDocument();

      // hide source
      fireEvent.click(screen.getByRole('button', { name: /hide source/i }));
      expect(screen.queryByText('test code')).not.toBeInTheDocument();
    });
  });

  describe('theme handling', () => {
    test('initializes mermaid with theme based on context', async () => {
      mockMermaid.default.render.mockResolvedValue({ svg: '<svg></svg>' });

      renderWithTheme(<MermaidRenderer code="flowchart TD" id="test-13" />);

      await waitFor(() => {
        // mermaid.initialize is called (theme comes from context)
        expect(mockMermaid.default.initialize).toHaveBeenCalled();
      });
    });
  });

  describe('effect cleanup', () => {
    test('does not update state after unmount', async () => {
      let resolveRender: ((value: { svg: string }) => void) | undefined;
      mockMermaid.default.render.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveRender = resolve;
          })
      );

      const { unmount } = renderWithTheme(
        <MermaidRenderer code="flowchart TD" id="test-15" />
      );

      // wait for effect to start
      await waitFor(() => {
        expect(resolveRender).toBeDefined();
      });

      // unmount before render completes
      unmount();

      // resolve after unmount - should not cause errors
      resolveRender!({ svg: '<svg></svg>' });

      // no error thrown = test passes
    });
  });
});
