// packages/webview-app/src/index.tsx
// webview entry point - initializes RPC & renders React app

import { createRoot } from 'react-dom/client';
import { initRPCWebviewSide } from './rpc-webview';
import { createTaggedLogger } from './utils/createTaggedLogger';
import { LogTags } from '@mdx-preview/shared';
import { ThemeProvider } from './theme';
import { LightboxProvider } from './context/LightboxContext';
// import directly to avoid barrel export import chain issues
import { WebviewStateProvider } from './context/WebviewStateProvider';
import { Lightbox } from './components/Lightbox/Lightbox';
import App from './App';
import './index.css';
// KaTeX CSS is lazy-loaded via utils/katexLoader.ts when math content is detected
// safe mode component styles (Callout, Collapsible, Tabs transforms)
import './styles/safe-components.css';
// code block styles (Shiki syntax highlighting w/ copy button, language badge)
import './components/CodeBlock/CodeBlock.css';

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
  <ThemeProvider>
    <LightboxProvider>
      <WebviewStateProvider>
        <App />
        <Lightbox />
      </WebviewStateProvider>
    </LightboxProvider>
  </ThemeProvider>
);
log.debug('App rendered');
