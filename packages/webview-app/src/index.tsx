// packages/webview-app/src/index.tsx
// webview entry point - initializes RPC & renders React app

import { createRoot } from 'react-dom/client';
import { initRPCWebviewSide } from './rpc-webview';
import { debug, debugError } from './utils/debug';
import { ThemeProvider } from './context/ThemeContext';
import App from './App';
import './index.css';
// KaTeX math rendering styles
import 'katex/dist/katex.min.css';

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
debug('[WEBVIEW] Rendering App with ThemeProvider...');
root.render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
debug('[WEBVIEW] App rendered');
