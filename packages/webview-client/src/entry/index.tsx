// packages/webview-client/src/entry/index.tsx
// webview entry point - initializes RPC & renders React app

import { createRoot } from 'react-dom/client';
import { initRPCWebviewSide } from '../platform/rpc/webview-rpc-client';
import { createTaggedLogger } from '../shared/utils/createTaggedLogger';
import { LogTags } from '@mdx-preview/contracts';
import { ThemeProvider } from '../features/theme/runtime';
import { LightboxProvider } from '../app/state/LightboxContext';
// import directly to avoid barrel export import chain issues
import { WebviewStateProvider } from '../app/providers/WebviewStateProvider';
import { RootErrorBoundary } from '../shared/ui/error-boundary/RootErrorBoundary';
import { Lightbox } from '../features/lightbox/ui/Lightbox';
import App from '../app/App';
import '../app/styles/index.css';
// KaTeX CSS is lazy-loaded via utils/katexLoader.ts when math content is detected
// safe mode component styles (Callout, Collapsible, Tabs transforms)
import '../features/preview/shared/styles/safe-components.css';
// code block styles (Shiki syntax highlighting w/ copy button, language badge)
import '../features/code-block/ui/CodeBlock.css';

// module-level tagged logger (avoids per-render allocation)
const log = createTaggedLogger(LogTags.WEBVIEW);

log.debug('index.tsx loaded');

// initialize RPC communication w/ extension
log.debug('Initializing RPC...');
initRPCWebviewSide();
log.debug('RPC initialized');

// react 18 createRoot API
const container = document.getElementById('root');
if (!container) {
  log.error('Root element not found!');
  throw new Error('Root element not found');
}

log.debug('Creating React root...');
const root = createRoot(container);
log.debug('Rendering App with providers...');
root.render(
  <RootErrorBoundary>
    <ThemeProvider>
      <LightboxProvider>
        <WebviewStateProvider>
          <App />
          <Lightbox />
        </WebviewStateProvider>
      </LightboxProvider>
    </ThemeProvider>
  </RootErrorBoundary>
);
log.debug('App rendered');
