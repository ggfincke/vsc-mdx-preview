// packages/webview-app/src/test/LoadingBar.test.tsx
// tests for LoadingBar component

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import LoadingBar from '../components/LoadingBar/LoadingBar';

describe('LoadingBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('delayed rendering', () => {
    it('does not render immediately by default', () => {
      render(<LoadingBar />);

      expect(screen.queryByText('Loading preview...')).not.toBeInTheDocument();
    });

    it('renders after 500ms delay', () => {
      render(<LoadingBar />);

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(screen.getByText('Loading preview...')).toBeInTheDocument();
    });

    it('does not render before 500ms', () => {
      render(<LoadingBar />);

      act(() => {
        vi.advanceTimersByTime(499);
      });

      expect(screen.queryByText('Loading preview...')).not.toBeInTheDocument();
    });
  });

  describe('immediate prop', () => {
    it('renders immediately when immediate is true', () => {
      render(<LoadingBar immediate />);

      expect(screen.getByText('Loading preview...')).toBeInTheDocument();
    });

    it('does not wait for timer when immediate is true', () => {
      render(<LoadingBar immediate />);

      // should be visible without advancing timers
      expect(screen.getByText('Loading preview...')).toBeInTheDocument();
    });
  });

  describe('structure', () => {
    it('renders loading container', () => {
      render(<LoadingBar immediate />);

      const container = document.querySelector('.mdx-loading-container');
      expect(container).toBeInTheDocument();
    });

    it('renders progress bar', () => {
      render(<LoadingBar immediate />);

      const progress = document.querySelector('.monaco-progress-container');
      expect(progress).toBeInTheDocument();
      expect(progress).toHaveClass('active', 'infinite');
    });

    it('renders progress bit with correct styles', () => {
      render(<LoadingBar immediate />);

      const progressBit = document.querySelector('.progress-bit');
      expect(progressBit).toBeInTheDocument();
      expect(progressBit).toHaveStyle({ opacity: '1' });
    });
  });

  describe('cleanup', () => {
    it('clears timer on unmount', () => {
      const { unmount } = render(<LoadingBar />);

      // unmount before timer fires
      unmount();

      // advance past timer - should not throw
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    });
  });
});
