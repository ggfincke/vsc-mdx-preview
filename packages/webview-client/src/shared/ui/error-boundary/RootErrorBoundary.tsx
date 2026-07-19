// packages/webview-client/src/shared/ui/error-boundary/RootErrorBoundary.tsx
// last-resort boundary above all providers; minimal fallback that cannot itself throw

import React from 'react';

interface RootErrorBoundaryProps {
  children: React.ReactNode;
}

interface RootErrorBoundaryState {
  error: Error | null;
}

export class RootErrorBoundary extends React.Component<
  RootErrorBoundaryProps,
  RootErrorBoundaryState
> {
  state: RootErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('MDX Preview root error:', error, info);
  }

  render(): React.ReactNode {
    if (this.state.error) {
      // inline styles only: CSS may not have loaded when this renders
      return (
        <div
          role="alert"
          style={{
            padding: '16px',
            fontFamily: 'var(--vscode-font-family, sans-serif)',
            color: 'var(--vscode-foreground, #ccc)',
          }}
        >
          <h2>MDX Preview crashed</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error.message}
          </pre>
          <p>
            Reopen the preview or run the &quot;MDX: Refresh Preview&quot;
            command. Check the webview developer tools for details.
          </p>
          <button onClick={() => this.setState({ error: null })}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default RootErrorBoundary;
