// packages/webview-client/src/features/preview/safe/security/safeModeStyles.ts
// safe mode placeholder styles

const STYLE_ID = 'mdx-safe-mode-styles';

// ensure safe mode placeholder styles are present in the document
// styles JSX placeholders & expression placeholders w/ dashed borders
// to indicate they couldn't be rendered in Safe Mode
export function ensureSafeModeStyles(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
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

    .mdx-safe-preview {
      padding: 16px;
    }
  `;
  document.head.appendChild(style);
}
