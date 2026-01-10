// packages/webview-app/src/components/ErrorBoundary/ErrorBoundary.tsx
// catch React errors & display VS Code-themed error UI (handles global errors too)

import React, { useEffect, useState, useCallback } from 'react';
import {
  ErrorBoundary as ReactErrorBoundary,
  FallbackProps,
} from 'react-error-boundary';
import {
  parseStackTrace,
  getFirstLocation,
  getDisplayPath,
  isUserCode,
  type StackFrame,
} from '../../utils/stackTraceParser';
import { ExtensionHandle } from '../../rpc-webview';
import './ErrorBoundary.css';

interface ErrorDisplayProps {
  error: Error;
  onReset?: () => void;
  title?: string;
}

// clickable stack trace component
function ClickableStackTrace({ stack }: { stack: string }) {
  const frames = parseStackTrace(stack);

  const handleFrameClick = useCallback(
    (frame: StackFrame) => {
      if (frame.isNavigable && frame.filePath && frame.line) {
        ExtensionHandle.openDocument(frame.filePath, frame.line, frame.column);
      }
    },
    []
  );

  return (
    <div className="mdx-error-stack-frames">
      {frames.map((frame, index) => (
        <div
          key={index}
          className={`mdx-error-stack-frame ${frame.isNavigable ? 'navigable' : ''} ${frame.filePath && isUserCode(frame.filePath) ? 'user-code' : ''}`}
          onClick={() => frame.isNavigable && handleFrameClick(frame)}
        >
          {frame.isNavigable ? (
            <>
              {frame.functionName && (
                <span className="mdx-error-frame-function">
                  {frame.functionName}
                </span>
              )}
              <span className="mdx-error-frame-location">
                {getDisplayPath(frame.filePath || '')}
                {frame.line && `:${frame.line}`}
                {frame.column && `:${frame.column}`}
              </span>
            </>
          ) : (
            <span className="mdx-error-frame-raw">{frame.raw}</span>
          )}
        </div>
      ))}
    </div>
  );
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

  // get first navigable location for "Open in Editor" button
  const firstLocation = error.stack ? getFirstLocation(error.stack) : null;

  const handleOpenInEditor = useCallback(() => {
    if (firstLocation) {
      ExtensionHandle.openDocument(
        firstLocation.filePath,
        firstLocation.line,
        firstLocation.column
      );
    }
  }, [firstLocation]);

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
            <details className="mdx-error-stack-details" open>
              <summary>Stack Trace (click to navigate)</summary>
              <ClickableStackTrace stack={error.stack} />
            </details>
          )}
        </div>
        <div className="mdx-error-actions">
          {firstLocation && (
            <button onClick={handleOpenInEditor} className="mdx-error-button">
              Open in Editor
            </button>
          )}
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

// MDX error boundary (wrap content w/ React error boundary & set up global error handlers)
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
