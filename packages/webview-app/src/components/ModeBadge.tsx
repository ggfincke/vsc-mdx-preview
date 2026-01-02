// packages/webview-app/src/components/ModeBadge.tsx
// display current preview mode (Safe/Trusted) w/ click-to-configure

import React from 'react';
import type { TrustState } from '../types';

interface ModeBadgeProps {
  trustState: TrustState;
  onConfigure?: () => void;
}

// mode badge component (shows Safe or Trusted mode w/ tooltip)
export function ModeBadge({ trustState, onConfigure }: ModeBadgeProps) {
  const { canExecute, workspaceTrusted, scriptsEnabled, reason } = trustState;

  const mode = canExecute ? 'Trusted' : 'Safe';

  let tooltip: string;
  if (canExecute) {
    tooltip = 'Full MDX rendering w/ JavaScript execution enabled';
  } else if (reason) {
    // use specific reason from trust manager
    tooltip = `Safe Mode: ${reason}`;
  } else if (!workspaceTrusted) {
    tooltip =
      'Safe Mode: Static HTML only. Trust this workspace to enable scripts.';
  } else if (!scriptsEnabled) {
    tooltip =
      'Safe Mode: Static HTML only. Enable scripts in settings for full rendering.';
  } else {
    tooltip = 'Safe Mode: Static HTML only';
  }

  return (
    <>
      <button
        className={`mode-badge ${canExecute ? 'trusted' : 'safe'}`}
        onClick={onConfigure}
        title={tooltip}
        aria-label={`Preview mode: ${mode}${onConfigure ? '. Click to configure.' : ''}`}
      >
        <span className="mode-badge-icon">{canExecute ? '✓' : '○'}</span>
        <span className="mode-badge-text">{mode}</span>
      </button>
      <style>{badgeStyles}</style>
    </>
  );
}

const badgeStyles = `
  .mode-badge {
    position: fixed;
    top: 8px;
    right: 8px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    z-index: 1000;
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    transition: opacity 0.2s;
  }

  .mode-badge:hover {
    opacity: 0.9;
  }

  .mode-badge.safe {
    background-color: var(--vscode-statusBarItem-warningBackground, #cca700);
    color: var(--vscode-statusBarItem-warningForeground, #000);
  }

  .mode-badge.trusted {
    background-color: var(--vscode-statusBarItem-prominentBackground, #007acc);
    color: var(--vscode-statusBarItem-prominentForeground, #fff);
  }

  .mode-badge-icon {
    font-size: 10px;
  }

  .mode-badge-text {
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
`;

export default ModeBadge;
