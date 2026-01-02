// packages/webview-app/src/components/ErrorBoundary.tsx
// catch React errors & display VS Code-themed error UI (handles global errors too)

import React, { useEffect, useState, useCallback } from 'react';
import {
  ErrorBoundary as ReactErrorBoundary,
  FallbackProps,
} from 'react-error-boundary';
import './ErrorBoundary.css';

interface ErrorDisplayProps {
  error: Error;
  onReset?: () => void;
  title?: string;
}

// error display component w/ VS Code styling
function ErrorDisplay({
  error,
  onReset,
  title = 'Preview Error',
}: ErrorDisplayProps) {
  const handleCopy = useCallback(() => {
    const text = `${error.message}\n\n${error.stack || ''}`;
    navigator.clipboard.writeText(text).catch(console.error);
  }, [error]);

  return (
    <div className="mdx-error-overlay">
      <div className="mdx-error-container">
        <div className="mdx-error-header">
          <span className="mdx-error-icon">!</span>
          <h2>{title}</h2>
        </div>
        <div className="mdx-error-content">
          <pre className="mdx-error-message">{error.message}</pre>
          {error.stack && (
            <details className="mdx-error-stack-details">
              <summary>Stack Trace</summary>
              <pre className="mdx-error-stack">{error.stack}</pre>
            </details>
          )}
        </div>
        <div className="mdx-error-actions">
          <button onClick={handleCopy} className="mdx-error-button">
            Copy Error
          </button>
          {onReset && (
            <button onClick={onReset} className="mdx-error-button primary">
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// fallback component for ReactErrorBoundary
function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <ErrorDisplay
      error={error}
      onReset={resetErrorBoundary}
      title="Render Error"
    />
  );
}

interface MDXErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error) => void;
}

// MDX error boundary (wraps content w/ React error boundary & sets up global error handlers)
export function MDXErrorBoundary({ children, onError }: MDXErrorBoundaryProps) {
  const [globalError, setGlobalError] = useState<Error | null>(null);

  // set up global error handlers
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      event.preventDefault();
      const error =
        event.error instanceof Error
          ? event.error
          : new Error(event.message || 'Unknown error');
      setGlobalError(error);
      onError?.(error);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      const error =
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason) || 'Unhandled promise rejection');
      setGlobalError(error);
      onError?.(error);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [onError]);

  // handle global errors
  if (globalError) {
    return (
      <ErrorDisplay
        error={globalError}
        onReset={() => setGlobalError(null)}
        title="Runtime Error"
      />
    );
  }

  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, info) => {
        console.error('MDX Preview Error:', error, info);
        onError?.(error);
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}

export default MDXErrorBoundary;
