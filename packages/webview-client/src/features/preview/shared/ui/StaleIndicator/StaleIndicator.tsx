// packages/webview-client/src/features/preview/shared/ui/StaleIndicator/StaleIndicator.tsx
// display a non-blocking badge when preview content is stale

import { memo } from 'react';
import './StaleIndicator.css';

interface StaleIndicatorProps {
  isStale: boolean;
}

// wrapped w/ React.memo to prevent re-renders when parent updates but isStale unchanged
export const StaleIndicator = memo(function StaleIndicator({
  isStale,
}: StaleIndicatorProps) {
  if (!isStale) {
    return null;
  }

  return (
    <div
      className="mdx-preview-stale-indicator"
      role="status"
      aria-live="polite"
    >
      Outdated
    </div>
  );
});

export default StaleIndicator;
