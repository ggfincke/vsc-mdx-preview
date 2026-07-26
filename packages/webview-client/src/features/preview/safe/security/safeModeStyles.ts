// packages/webview-client/src/features/preview/safe/security/safeModeStyles.ts
// safe mode placeholder styles

import { SAFE_PREVIEW_CLASS } from '../../../../shared/preview-constants';
import {
  STYLE_IDS,
  StyleInjector,
} from '../../../../shared/utils/StyleInjector';

const SAFE_MODE_CSS = `
    .mdx-jsx-placeholder,
    .mdx-expression-placeholder {
      display: inline-block;
      padding: 2px 6px;
      margin: 2px;
      background-color: var(--vscode-textBlockQuote-background, rgba(127, 127, 127, 0.1));
      border: 1px dashed var(--vscode-textBlockQuote-border, rgba(127, 127, 127, 0.3));
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 0.9em;
      color: var(--vscode-descriptionForeground, #717171);
      cursor: help;
    }

    .${SAFE_PREVIEW_CLASS} {
      padding: 16px;
    }
  `;

// ensure safe mode placeholder styles are present in the document
// styles JSX placeholders & expression placeholders w/ dashed borders
// to indicate they couldn't be rendered in Safe Mode
export function ensureSafeModeStyles(): void {
  StyleInjector.inject(STYLE_IDS.SAFE_MODE, SAFE_MODE_CSS);
}
