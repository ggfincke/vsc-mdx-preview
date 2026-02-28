// packages/webview-client/src/features/preview/shared/ui/TrustBanner/TrustBanner.tsx
// banner displayed in Safe Mode to inform user & provide actions to enable Trusted Mode

import { memo, useState, useCallback, useEffect } from 'react';
import type { TrustState } from '../../../../../app/types';
import { ExtensionHandle } from '../../../../../platform/rpc/webview-rpc-client';
import './TrustBanner.css';

interface TrustBannerProps {
  trustState: TrustState;
  // dismissible
  dismissible?: boolean;
}

const DISMISSED_BANNER_KEY_STORAGE = 'mdx-preview.trust-banner.dismissed';

function readDismissedBannerKey(): string | null {
  try {
    return window.localStorage.getItem(DISMISSED_BANNER_KEY_STORAGE);
  } catch {
    return null;
  }
}

function writeDismissedBannerKey(key: string | null): void {
  try {
    if (key === null) {
      window.localStorage.removeItem(DISMISSED_BANNER_KEY_STORAGE);
      return;
    }
    window.localStorage.setItem(DISMISSED_BANNER_KEY_STORAGE, key);
  } catch {
    // ignore storage failures in restricted webview contexts
  }
}

function getBannerKey(trustState: TrustState): string | null {
  if (trustState.canExecute) {
    return null;
  }

  if (!trustState.workspaceTrusted) {
    return 'workspace-untrusted';
  }

  if (!trustState.scriptsEnabled) {
    return 'scripts-disabled';
  }

  return trustState.reason
    ? `restricted:${trustState.reason}`
    : 'restricted:unknown';
}

// trust banner component - display warning banner in Safe Mode w/ actions to enable Trusted Mode
//
// states
// - Safe Mode (untrusted workspace): show warning w/ "Manage Trust" button
// - Safe Mode (scripts disabled): show info w/ "Enable Scripts" button
// - Trusted Mode: hidden (no banner needed)
//
// wrapped w/ React.memo to prevent re-renders when parent updates but trust state unchanged
export const TrustBanner = memo(
  function TrustBanner({ trustState, dismissible = true }: TrustBannerProps) {
    const [dismissedBannerKey, setDismissedBannerKey] = useState<string | null>(
      () => readDismissedBannerKey()
    );
    const currentBannerKey = getBannerKey(trustState);

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
    if (currentBannerKey === null || isDismissed) {
      return null;
    }

    // determine banner type & message based on trust state
    const bannerConfig = getBannerConfig(trustState);

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

interface BannerConfig {
  type: 'warning' | 'info';
  icon: string;
  title: string;
  message: string;
}

function getBannerConfig(trustState: TrustState): BannerConfig {
  const { workspaceTrusted, scriptsEnabled, reason } = trustState;

  if (!workspaceTrusted) {
    return {
      type: 'warning',
      icon: '\u26A0',
      title: 'Safe Mode',
      message:
        reason ||
        'This workspace is not trusted. JavaScript execution is disabled for security.',
    };
  }

  if (!scriptsEnabled) {
    return {
      type: 'info',
      icon: '\u2139',
      title: 'Safe Mode',
      message:
        reason ||
        'Scripts are disabled. Enable scripts in settings for full MDX rendering.',
    };
  }

  // remote environment or other restriction
  return {
    type: 'warning',
    icon: '\u26A0',
    title: 'Safe Mode',
    message: reason || 'JavaScript execution is not available in this context.',
  };
}

export default TrustBanner;
