// packages/webview-client/src/features/preview/shared/ui/TrustBanner/TrustBanner.tsx
// banner displayed in Safe Mode to inform user & provide actions to enable Trusted Mode

import { memo, useState, useCallback, useEffect } from 'react';
import type { TrustState } from '../../../../../app/types';
import { ExtensionHandle } from '../../../../../platform/rpc/webview-rpc-client';
import {
  getItem,
  setItem,
  removeItem,
} from '../../../../../shared/utils/safeLocalStorage';
import './TrustBanner.css';

interface TrustBannerProps {
  trustState: TrustState;
  // dismissible
  dismissible?: boolean;
}

const DISMISSED_BANNER_KEY_STORAGE = 'mdx-preview.trust-banner.dismissed';

function readDismissedBannerKey(): string | null {
  return getItem(DISMISSED_BANNER_KEY_STORAGE);
}

function writeDismissedBannerKey(key: string | null): void {
  if (key === null) {
    removeItem(DISMISSED_BANNER_KEY_STORAGE);
    return;
  }
  setItem(DISMISSED_BANNER_KEY_STORAGE, key);
}

interface BannerConfig {
  type: 'warning' | 'info';
  icon: string;
  title: string;
  message: string;
}

// resolve dismissal key & display config from a single trust-state cascade
// (one source keeps key & rendered banner in lockstep)
function getBannerState(
  trustState: TrustState
): { key: string; config: BannerConfig } | null {
  if (trustState.canExecute) {
    return null;
  }

  const { workspaceTrusted, scriptsEnabled, reason } = trustState;

  if (!workspaceTrusted) {
    return {
      key: 'workspace-untrusted',
      config: {
        type: 'warning',
        icon: '⚠',
        title: 'Safe Mode',
        message:
          reason ||
          'This workspace is not trusted. JavaScript execution is disabled for security.',
      },
    };
  }

  if (!scriptsEnabled) {
    return {
      key: 'scripts-disabled',
      config: {
        type: 'info',
        icon: 'ℹ',
        title: 'Safe Mode',
        message:
          reason ||
          'Scripts are disabled. Enable scripts in settings for full MDX rendering.',
      },
    };
  }

  // remote environment or other restriction
  return {
    key: reason ? `restricted:${reason}` : 'restricted:unknown',
    config: {
      type: 'warning',
      icon: '⚠',
      title: 'Safe Mode',
      message:
        reason || 'JavaScript execution is not available in this context.',
    },
  };
}

// trust banner for Safe Mode trust & script actions
// wrapped w/ React.memo to avoid parent-driven re-renders
export const TrustBanner = memo(
  function TrustBanner({ trustState, dismissible = true }: TrustBannerProps) {
    const [dismissedBannerKey, setDismissedBannerKey] = useState<string | null>(
      () => readDismissedBannerKey()
    );
    const bannerState = getBannerState(trustState);
    const currentBannerKey = bannerState ? bannerState.key : null;

    const handleManageTrust = useCallback(() => {
      ExtensionHandle.manageTrust();
    }, []);

    const handleEnableScripts = useCallback(() => {
      ExtensionHandle.openSettings('mdx-preview.preview.enableScripts');
    }, []);

    const handleDismiss = useCallback(() => {
      if (!currentBannerKey) {
        return;
      }
      setDismissedBannerKey(currentBannerKey);
      writeDismissedBannerKey(currentBannerKey);
    }, [currentBannerKey]);

    useEffect(() => {
      if (trustState.canExecute && dismissedBannerKey !== null) {
        setDismissedBannerKey(null);
        writeDismissedBannerKey(null);
      }
    }, [trustState.canExecute, dismissedBannerKey]);

    const isDismissed =
      dismissible &&
      currentBannerKey !== null &&
      dismissedBannerKey === currentBannerKey;

    // don't show banner if in Trusted Mode or dismissed
    if (bannerState === null || isDismissed) {
      return null;
    }

    // banner type & message resolved by the shared cascade above
    const bannerConfig = bannerState.config;

    return (
      <div
        className={`mdx-preview-trust-banner mdx-preview-trust-banner--${bannerConfig.type}`}
        role="alert"
        aria-live="polite"
      >
        <div className="mdx-preview-trust-banner__icon" aria-hidden="true">
          {bannerConfig.icon}
        </div>
        <div className="mdx-preview-trust-banner__content">
          <span className="mdx-preview-trust-banner__title">
            {bannerConfig.title}
          </span>
          <span className="mdx-preview-trust-banner__message">
            {bannerConfig.message}
          </span>
        </div>
        <div className="mdx-preview-trust-banner__actions">
          {!trustState.workspaceTrusted && (
            <button
              className="mdx-preview-trust-banner__button mdx-preview-trust-banner__button--primary"
              onClick={handleManageTrust}
              type="button"
            >
              Manage Trust
            </button>
          )}
          {trustState.workspaceTrusted && !trustState.scriptsEnabled && (
            <button
              className="mdx-preview-trust-banner__button mdx-preview-trust-banner__button--primary"
              onClick={handleEnableScripts}
              type="button"
            >
              Enable Scripts
            </button>
          )}
          {dismissible && (
            <button
              className="mdx-preview-trust-banner__button mdx-preview-trust-banner__button--secondary"
              onClick={handleDismiss}
              type="button"
              aria-label="Dismiss banner"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    );
  },
  // only re-render if relevant trust state fields change
  arePropsEqual
);

// custom memo comparison for TrustBanner
function arePropsEqual(
  prevProps: TrustBannerProps,
  nextProps: TrustBannerProps
): boolean {
  return (
    prevProps.trustState.workspaceTrusted ===
      nextProps.trustState.workspaceTrusted &&
    prevProps.trustState.scriptsEnabled ===
      nextProps.trustState.scriptsEnabled &&
    prevProps.trustState.canExecute === nextProps.trustState.canExecute &&
    prevProps.trustState.reason === nextProps.trustState.reason &&
    prevProps.dismissible === nextProps.dismissible
  );
}
