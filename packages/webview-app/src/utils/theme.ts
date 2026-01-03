// packages/webview-app/src/utils/theme.ts
// theme detection utility using MutationObserver on body class

export type Theme = 'light' | 'dark' | 'high-contrast';

/**
 * Get the current VS Code theme from body class.
 */
export function getCurrentTheme(): Theme {
  const body = document.body;
  if (body.classList.contains('vscode-high-contrast')) {
    return 'high-contrast';
  }
  if (body.classList.contains('vscode-dark')) {
    return 'dark';
  }
  return 'light';
}

/**
 * Subscribe to theme changes via MutationObserver on body class.
 * Returns a cleanup function to disconnect the observer.
 */
export function onThemeChange(callback: (theme: Theme) => void): () => void {
  let lastTheme = getCurrentTheme();

  const observer = new MutationObserver(() => {
    const currentTheme = getCurrentTheme();
    if (currentTheme !== lastTheme) {
      lastTheme = currentTheme;
      callback(currentTheme);
    }
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class'],
  });

  return () => observer.disconnect();
}
