// packages/webview-app/src/components/StaleIndicator/StaleIndicator.tsx
// display a non-blocking badge when preview content is stale

import './StaleIndicator.css';

interface StaleIndicatorProps {
  isStale: boolean;
}

export function StaleIndicator({ isStale }: StaleIndicatorProps) {
  if (!isStale) {
    return null;
  }

  return (
    <div className="stale-indicator" role="status" aria-live="polite">
      Outdated
    </div>
  );
}

export default StaleIndicator;
