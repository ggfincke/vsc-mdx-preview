// packages/webview-app/src/components/LoadingBar/LoadingBar.tsx
// show VS Code-style progress bar during loading states

import React, { useState, useEffect } from 'react';
import './LoadingBar.css';

// delay before showing loading bar to avoid flicker
const SHOW_AFTER_DURATION = 500;

interface LoadingBarProps {
  // whether to show the loading bar immediately
  immediate?: boolean;
}

const LoadingBar: React.FC<LoadingBarProps> = ({ immediate = false }) => {
  const [shouldShow, setShouldShow] = useState(immediate);

  useEffect(() => {
    if (immediate) {
      setShouldShow(true);
      return;
    }

    const timer = setTimeout(() => {
      setShouldShow(true);
    }, SHOW_AFTER_DURATION);

    return () => clearTimeout(timer);
  }, [immediate]);

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="mdx-loading-container">
      <div className="monaco-progress-container active infinite">
        <div
          className="progress-bit"
          style={{
            backgroundColor: 'var(--vscode-progressBar-background, #0E70C0)',
            opacity: 1,
          }}
        />
      </div>
      <p className="mdx-loading-text">Loading preview...</p>
    </div>
  );
};

export default LoadingBar;
