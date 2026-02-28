// packages/webview-client/src/shared/ui/error-boundary/ErrorBoundary.tsx
// catch React errors & display VS Code-themed error UI (handle global errors too)

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
import type { StackFrame } from '../../utils/stackTraceParser';
import { copyToClipboard } from '../../utils/clipboard';
import { isModuleErrorData } from '@mdx-preview/contracts';
import { normalizeError } from '@mdx-preview/runtime-utils';
import type { ModuleErrorData } from '@mdx-preview/contracts';
import { ModuleError } from '../../../features/module-runtime/errors';
import { ExtensionHandle } from '../../../platform/rpc/webview-rpc-client';

// type for Error objects that may have moduleError attached (from PreviewError)
type ErrorWithModuleData = Error & { moduleError?: ModuleErrorData };
import './ErrorBoundary.css';

// stack trace component
function StackTrace({
  stack,
  onNavigate,
}: {
  stack: string;
  onNavigate?: (frame: StackFrame) => void;
}) {
  const frames = parseStackTrace(stack);

  return (
    <div className="mdx-preview-error-stack-frames">
      {frames.map((frame, index) => {
        const isNav =
          frame.isNavigable &&
          !!frame.filePath &&
          isUserCode(frame.filePath) &&
          !!onNavigate;
        return (
          <div
            key={index}
            className={`mdx-preview-error-stack-frame ${frame.filePath && isUserCode(frame.filePath) ? 'user-code' : ''} ${isNav ? 'navigable' : ''}`}
            onClick={isNav ? () => onNavigate(frame) : undefined}
            role={isNav ? 'button' : undefined}
            tabIndex={isNav ? 0 : undefined}
            onKeyDown={
              isNav
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onNavigate(frame);
                    }
                  }
                : undefined
            }
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
                <span className="mdx-preview-error-frame-open-hint">Open</span>
              </>
            ) : (
              <span className="mdx-preview-error-frame-raw">{frame.raw}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// error display props for external use
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
  if (
    errorWithData.moduleError &&
    isModuleErrorData(errorWithData.moduleError)
  ) {
    return errorWithData.moduleError.suggestions;
  }
  return [];
}

// error display component w/ VS Code styling
// exported for reuse in App.tsx & other error handling contexts
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

  // navigate to a stack frame in the editor
  const handleNavigate = useCallback((frame: StackFrame) => {
    if (!frame.filePath) {
      return;
    }

    void ExtensionHandle.openDocument(frame.filePath, frame.line, frame.column)
      .then(() => undefined)
      .catch(() => undefined);
  }, []);

  return (
    <div
      className="mdx-preview-error-overlay"
      role="alert"
      aria-live="assertive"
    >
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
              <StackTrace stack={error.stack} onNavigate={handleNavigate} />
            </details>
          )}
        </div>
        <div className="mdx-preview-error-actions">
          <button onClick={handleCopy} className="mdx-preview-error-button">
            Copy Error
          </button>
          {onReset && (
            <button
              onClick={onReset}
              className="mdx-preview-error-button primary"
            >
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
      error={normalizeError(error)}
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
      const error = normalizeError(
        event.error ?? event.message ?? 'Unknown error'
      );
      setGlobalError(error);
      onError?.(error);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      const error = normalizeError(
        event.reason ?? 'Unhandled promise rejection'
      );
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
        onError?.(normalizeError(error));
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}

export default MDXErrorBoundary;
