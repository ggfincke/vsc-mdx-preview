// packages/webview-app/src/test/TrustBanner.test.tsx
// tests for TrustBanner component

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { TrustBanner } from '../components/TrustBanner/TrustBanner';
import type { TrustState } from '../types';

// mock RPC module
vi.mock('../rpc-webview', () => ({
  ExtensionHandle: {
    manageTrust: vi.fn(),
    openSettings: vi.fn(),
  },
}));

import { ExtensionHandle } from '../rpc-webview';

describe('TrustBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('visibility', () => {
    it('is hidden when canExecute is true', () => {
      const trustState: TrustState = {
        workspaceTrusted: true,
        scriptsEnabled: true,
        canExecute: true,
      };

      const { container } = render(<TrustBanner trustState={trustState} />);
      expect(container.firstChild).toBeNull();
    });

    it('is visible when canExecute is false', () => {
      const trustState: TrustState = {
        workspaceTrusted: false,
        scriptsEnabled: false,
        canExecute: false,
      };

      render(<TrustBanner trustState={trustState} />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('untrusted workspace variant', () => {
    const untrustedState: TrustState = {
      workspaceTrusted: false,
      scriptsEnabled: false,
      canExecute: false,
    };

    it('shows warning banner type', () => {
      render(<TrustBanner trustState={untrustedState} />);

      const banner = document.querySelector('.trust-banner--warning');
      expect(banner).toBeInTheDocument();
    });

    it('shows "Safe Mode" title', () => {
      render(<TrustBanner trustState={untrustedState} />);

      expect(screen.getByText('Safe Mode')).toBeInTheDocument();
    });

    it('shows "Manage Trust" button', () => {
      render(<TrustBanner trustState={untrustedState} />);

      expect(screen.getByText('Manage Trust')).toBeInTheDocument();
    });

    it('calls manageTrust when "Manage Trust" clicked', async () => {
      const user = userEvent.setup();
      render(<TrustBanner trustState={untrustedState} />);

      await user.click(screen.getByText('Manage Trust'));

      expect(ExtensionHandle.manageTrust).toHaveBeenCalled();
    });

    it('does not show "Enable Scripts" button', () => {
      render(<TrustBanner trustState={untrustedState} />);

      expect(screen.queryByText('Enable Scripts')).not.toBeInTheDocument();
    });
  });

  describe('trusted but scripts disabled variant', () => {
    const scriptsDisabledState: TrustState = {
      workspaceTrusted: true,
      scriptsEnabled: false,
      canExecute: false,
    };

    it('shows info banner type', () => {
      render(<TrustBanner trustState={scriptsDisabledState} />);

      const banner = document.querySelector('.trust-banner--info');
      expect(banner).toBeInTheDocument();
    });

    it('shows "Enable Scripts" button', () => {
      render(<TrustBanner trustState={scriptsDisabledState} />);

      expect(screen.getByText('Enable Scripts')).toBeInTheDocument();
    });

    it('calls openSettings when "Enable Scripts" clicked', async () => {
      const user = userEvent.setup();
      render(<TrustBanner trustState={scriptsDisabledState} />);

      await user.click(screen.getByText('Enable Scripts'));

      expect(ExtensionHandle.openSettings).toHaveBeenCalledWith(
        'mdx-preview.preview.enableScripts'
      );
    });

    it('does not show "Manage Trust" button', () => {
      render(<TrustBanner trustState={scriptsDisabledState} />);

      expect(screen.queryByText('Manage Trust')).not.toBeInTheDocument();
    });
  });

  describe('dismiss functionality', () => {
    const trustState: TrustState = {
      workspaceTrusted: false,
      scriptsEnabled: false,
      canExecute: false,
    };

    it('shows dismiss button when dismissible (default)', () => {
      render(<TrustBanner trustState={trustState} />);

      expect(screen.getByText('Dismiss')).toBeInTheDocument();
    });

    it('hides banner when dismiss clicked', async () => {
      const user = userEvent.setup();
      render(<TrustBanner trustState={trustState} />);

      await user.click(screen.getByText('Dismiss'));

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('hides dismiss button when dismissible is false', () => {
      render(<TrustBanner trustState={trustState} dismissible={false} />);

      expect(screen.queryByText('Dismiss')).not.toBeInTheDocument();
    });
  });

  describe('custom reason message', () => {
    it('displays custom reason from trust state', () => {
      const trustState: TrustState = {
        workspaceTrusted: false,
        scriptsEnabled: false,
        canExecute: false,
        reason: 'Custom security message here',
      };

      render(<TrustBanner trustState={trustState} />);

      expect(
        screen.getByText('Custom security message here')
      ).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    const trustState: TrustState = {
      workspaceTrusted: false,
      scriptsEnabled: false,
      canExecute: false,
    };

    it('has role="alert"', () => {
      render(<TrustBanner trustState={trustState} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('has aria-live="polite"', () => {
      render(<TrustBanner trustState={trustState} />);

      const banner = screen.getByRole('alert');
      expect(banner).toHaveAttribute('aria-live', 'polite');
    });

    it('dismiss button has aria-label', () => {
      render(<TrustBanner trustState={trustState} />);

      const dismissBtn = screen.getByLabelText('Dismiss banner');
      expect(dismissBtn).toBeInTheDocument();
    });
  });
});
