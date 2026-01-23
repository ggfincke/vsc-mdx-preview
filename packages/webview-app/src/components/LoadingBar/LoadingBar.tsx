// packages/webview-app/src/components/LoadingBar/LoadingBar.tsx
// show VS Code-style progress bar during loading states

import React, { memo, useState, useEffect } from 'react';
import './LoadingBar.css';
import { LOADING_BAR_SHOW_DELAY_MS } from '../../constants';

interface LoadingBarProps {
  // whether to show the loading bar immediately
  immediate?: boolean;
}

// wrapped with React.memo to prevent re-renders when parent updates but immediate unchanged
const LoadingBar: React.FC<LoadingBarProps> = memo(function LoadingBar({
  immediate = false,
}) {
  const [shouldShow, setShouldShow] = useState(immediate);

  useEffect(() => {
    if (immediate) {
      setShouldShow(true);
      return;
    }

    const timer = setTimeout(() => {
      setShouldShow(true);
    }, LOADING_BAR_SHOW_DELAY_MS);

    return () => clearTimeout(timer);
  }, [immediate]);

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="mdx-preview-loading-container">
      <div className="monaco-progress-container active infinite">
        <div
          className="progress-bit"
          style={{
            backgroundColor: 'var(--vscode-progressBar-background, #0E70C0)',
            opacity: 1,
          }}
        />
      </div>
      <p className="mdx-preview-loading-text">Loading preview...</p>
    </div>
  );
});

export default LoadingBar;
