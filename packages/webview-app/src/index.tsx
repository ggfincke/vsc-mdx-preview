import { createRoot } from 'react-dom/client';
import { initRPCWebviewSide } from './rpc-webview';
import App from './App';
import './index.css';

console.log('[WEBVIEW] index.tsx loaded');

// Initialize RPC communication with extension
console.log('[WEBVIEW] Initializing RPC...');
initRPCWebviewSide();
console.log('[WEBVIEW] RPC initialized');

// React 18 createRoot API
const container = document.getElementById('root');
if (!container) {
  console.error('[WEBVIEW] Root element not found!');
  throw new Error('Root element not found');
}

console.log('[WEBVIEW] Creating React root...');
const root = createRoot(container);
console.log('[WEBVIEW] Rendering App...');
root.render(<App />);
console.log('[WEBVIEW] App rendered');
