// packages/webview-app/src/index.tsx
// webview entry point - initializes RPC & renders React app

import { createRoot } from 'react-dom/client';
import { initRPCWebviewSide } from './rpc-webview';
import { debug, debugError } from './utils/debug';
import { ThemeProvider } from './theme';
import { LightboxProvider } from './context/LightboxContext';
// Import directly to avoid barrel export import chain issues
import { WebviewStateProvider } from './context/WebviewStateProvider';
import { Lightbox } from './components/Lightbox';
import App from './App';
import './index.css';
// KaTeX CSS is lazy-loaded via utils/katexLoader.ts when math content is detected
// Safe Mode component styles (Callout, Collapsible, Tabs transforms)
import './styles/safe-components.css';
// Code block styles (Shiki syntax highlighting w/ copy button, language badge)
import './components/CodeBlock/CodeBlock.css';

debug('[WEBVIEW] index.tsx loaded');

// initialize RPC communication w/ extension
debug('[WEBVIEW] Initializing RPC...');
initRPCWebviewSide();
debug('[WEBVIEW] RPC initialized');

// React 18 createRoot API
const container = document.getElementById('root');
if (!container) {
  debugError('[WEBVIEW] Root element not found!');
  throw new Error('Root element not found');
}

debug('[WEBVIEW] Creating React root...');
const root = createRoot(container);
debug('[WEBVIEW] Rendering App with providers...');
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
debug('[WEBVIEW] App rendered');
