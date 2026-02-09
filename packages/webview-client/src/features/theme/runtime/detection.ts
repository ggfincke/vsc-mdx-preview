// packages/webview-app/src/theme/detection.ts
// VS Code theme detection via MutationObserver on body class

export type VSCodeTheme = 'light' | 'dark' | 'high-contrast';

// get the current VS Code theme from body class
export function getCurrentVSCodeTheme(): VSCodeTheme {
  const body = document.body;
  if (body.classList.contains('vscode-high-contrast')) {
    return 'high-contrast';
  }
  if (body.classList.contains('vscode-dark')) {
    return 'dark';
  }
  return 'light';
}

// subscribe to VS Code theme changes via MutationObserver on body class
// return cleanup function to disconnect observer
export function onVSCodeThemeChange(
  callback: (theme: VSCodeTheme) => void
): () => void {
  let lastTheme = getCurrentVSCodeTheme();

  const observer = new MutationObserver(() => {
    const currentTheme = getCurrentVSCodeTheme();
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

// check if VS Code is using a dark theme
export function isVSCodeDark(theme: VSCodeTheme): boolean {
  return theme === 'dark' || theme === 'high-contrast';
}
