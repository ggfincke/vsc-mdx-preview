// packages/webview-app/src/components/ErrorBoundary/ErrorBoundary.tsx
// catch React errors & display VS Code-themed error UI (handles global errors too)

import React, { useEffect, useState, useCallback } from 'react';
import {
  ErrorBoundary as ReactErrorBoundary,
  FallbackProps,
} from 'react-error-boundary';
import {
  parseStackTrace,
  getDisplayPath,
  isUserCode,
} from '../../utils/stackTraceParser';
import { copyToClipboard } from '../../utils/clipboard';
import { normalizeError, isModuleErrorData } from '@mdx-preview/shared';
import type { ModuleErrorData } from '@mdx-preview/shared';
import { ModuleError } from '../../module-system/errors';

// type for Error objects that may have moduleError attached (from PreviewError)
type ErrorWithModuleData = Error & { moduleError?: ModuleErrorData };
import './ErrorBoundary.css';

// stack trace component
function StackTrace({ stack }: { stack: string }) {
  const frames = parseStackTrace(stack);

  return (
    <div className="mdx-preview-error-stack-frames">
      {frames.map((frame, index) => (
        <div
          key={index}
          className={`mdx-preview-error-stack-frame ${frame.filePath && isUserCode(frame.filePath) ? 'user-code' : ''}`}
        >
          {frame.isNavigable ? (
            <>
              {frame.functionName && (
                <span className="mdx-preview-error-frame-function">
                  {frame.functionName}
                </span>
              )}
              <span className="mdx-preview-error-frame-location">
                {getDisplayPath(frame.filePath || '')}
                {frame.line && `:${frame.line}`}
                {frame.column && `:${frame.column}`}
              </span>
            </>
          ) : (
            <span className="mdx-preview-error-frame-raw">{frame.raw}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// Error display props for external use
export interface ErrorDisplayProps {
  error: Error;
  onReset?: () => void;
  title?: string;
}

// extract suggestions from ModuleError or attached moduleError
function extractSuggestions(error: Error): string[] {
  // handle direct ModuleError from webview-side errors
  if (error instanceof ModuleError) {
    return error.suggestions;
  }
  // handle Error w/ moduleError attached from extension via RPC
  const errorWithData = error as ErrorWithModuleData;
  if (errorWithData.moduleError && isModuleErrorData(errorWithData.moduleError)) {
    return errorWithData.moduleError.suggestions;
  }
  return [];
}

// Error display component w/ VS Code styling
// Exported for reuse in App.tsx & other error handling contexts
export function ErrorDisplay({
  error,
  onReset,
  title = 'Preview Error',
}: ErrorDisplayProps) {
  // extract suggestions from ModuleError or attached moduleError
  const suggestions = extractSuggestions(error);

  const handleCopy = useCallback(() => {
    const text = `${error.message}\n\n${error.stack || ''}`;
    void copyToClipboard(text);
  }, [error]);

  return (
    <div className="mdx-preview-error-overlay" role="alert" aria-live="assertive">
      <div className="mdx-preview-error-container">
        <div className="mdx-preview-error-header">
          <span className="mdx-preview-error-icon">!</span>
          <h2>{title}</h2>
        </div>
        <div className="mdx-preview-error-content">
          <pre className="mdx-preview-error-message">{error.message}</pre>
          {suggestions.length > 0 && (
            <div className="mdx-preview-error-suggestions">
              <strong>Try:</strong>
              <ul>
                {suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
          {error.stack && (
            <details className="mdx-preview-error-stack-details" open>
              <summary>Stack Trace</summary>
              <StackTrace stack={error.stack} />
            </details>
          )}
        </div>
        <div className="mdx-preview-error-actions">
          <button onClick={handleCopy} className="mdx-preview-error-button">
            Copy Error
          </button>
          {onReset && (
            <button onClick={onReset} className="mdx-preview-error-button primary">
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
      const error = normalizeError(event.error ?? event.message ?? 'Unknown error');
      setGlobalError(error);
      onError?.(error);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      const error = normalizeError(event.reason ?? 'Unhandled promise rejection');
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
