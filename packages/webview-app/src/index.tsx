// packages/webview-app/src/index.tsx
// webview entry point - initializes RPC & renders React app

import { createRoot } from 'react-dom/client';
import { initRPCWebviewSide } from './rpc-webview';
import { debug, debugError } from './utils/debug';
import { ThemeProvider } from './theme';
import { LightboxProvider } from './context/LightboxContext';
import { Lightbox } from './components/Lightbox';
import App from './App';
import './index.css';
// KaTeX math rendering styles
import 'katex/dist/katex.min.css';
// Safe Mode component styles (Callout, Collapsible, Tabs transforms)
import './styles/safe-components.css';
// Code block styles (Shiki syntax highlighting with copy button, language badge)
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
debug('[WEBVIEW] Rendering App with ThemeProvider & LightboxProvider...');
root.render(
  <ThemeProvider>
    <LightboxProvider>
      <App />
      <Lightbox />
    </LightboxProvider>
  </ThemeProvider>
);
debug('[WEBVIEW] App rendered');
