// packages/webview-app/src/components/shims/starlight/Code.tsx
// Starlight Code component shim for MDX Preview
// provides preview-compatible version of @astrojs/starlight/components Code

import { createCodeBlock } from '../base/BaseCodeBlock';

// languages that should use terminal frame by default
const TERMINAL_LANGUAGES = new Set([
  'bash',
  'sh',
  'zsh',
  'shell',
  'console',
  'powershell',
  'ps1',
  'cmd',
  'batch',
]);

// code component using shared factory
export const Code = createCodeBlock({
  classPrefix: 'mdx-preview-starlight-code',
  codeAsString: true,
  supportsFrames: true,
  terminalLanguages: TERMINAL_LANGUAGES,
  showLangBadgeWithTitle: false,
});

// re-export props type for consumers w/ Starlight-compatible aliases
export interface CodeProps {
  code: string;
  lang?: string;
  title?: string;
  meta?: string;
  mark?: (number | string)[];
  frame?: 'code' | 'terminal' | 'none' | 'auto';
  locale?: string;
}

export default Code;
