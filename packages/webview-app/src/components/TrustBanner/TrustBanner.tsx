// packages/webview-app/src/components/TrustBanner/TrustBanner.tsx
// banner displayed in Safe Mode to inform user and provide actions to enable Trusted Mode

import { useState, useCallback } from 'react';
import type { TrustState } from '../../types';
import { ExtensionHandle } from '../../rpc-webview';
import './TrustBanner.css';

interface TrustBannerProps {
  trustState: TrustState;
  // whether the banner can be dismissed
  dismissible?: boolean;
}

// TrustBanner component - display warning banner in Safe Mode w/ actions to enable Trusted Mode
//
// States:
// - Safe Mode (untrusted workspace): show warning w/ "Manage Trust" button
// - Safe Mode (scripts disabled): show info w/ "Enable Scripts" button
// - Trusted Mode: hidden (no banner needed)
export function TrustBanner({
  trustState,
  dismissible = true,
}: TrustBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  const handleManageTrust = useCallback(() => {
    ExtensionHandle.manageTrust();
  }, []);

  const handleEnableScripts = useCallback(() => {
    ExtensionHandle.openSettings('mdx-preview.preview.enableScripts');
  }, []);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
  }, []);

  // don't show banner if in Trusted Mode or dismissed
  if (trustState.canExecute || isDismissed) {
    return null;
  }

  // determine banner type & message based on trust state
  const bannerConfig = getBannerConfig(trustState);

  return (
    <div
      className={`trust-banner trust-banner--${bannerConfig.type}`}
      role="alert"
      aria-live="polite"
    >
      <div className="trust-banner__icon" aria-hidden="true">
        {bannerConfig.icon}
      </div>
      <div className="trust-banner__content">
        <span className="trust-banner__title">{bannerConfig.title}</span>
        <span className="trust-banner__message">{bannerConfig.message}</span>
      </div>
      <div className="trust-banner__actions">
        {!trustState.workspaceTrusted && (
          <button
            className="trust-banner__button trust-banner__button--primary"
            onClick={handleManageTrust}
            type="button"
          >
            Manage Trust
          </button>
        )}
        {trustState.workspaceTrusted && !trustState.scriptsEnabled && (
          <button
            className="trust-banner__button trust-banner__button--primary"
            onClick={handleEnableScripts}
            type="button"
          >
            Enable Scripts
          </button>
        )}
        {dismissible && (
          <button
            className="trust-banner__button trust-banner__button--secondary"
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
