// packages/webview-app/src/context/ThemeContext.tsx
// React context for VS Code theme detection & synchronization
// extended w/ MPE-style preview theme support

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import { getCurrentTheme, onThemeChange, type Theme } from '../utils/theme';
import { injectPreviewTheme, injectCodeBlockTheme } from '../utils/themeLoader';
import type { PreviewTheme, CodeBlockTheme, WebviewThemeState } from '../themes/types';

interface ThemeContextValue {
  // VS Code theme
  theme: Theme;
  isDark: boolean;
  isHighContrast: boolean;
  // MPE preview theme
  previewTheme: PreviewTheme;
  codeBlockTheme: CodeBlockTheme;
  setPreviewThemeState: (state: WebviewThemeState) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
}

// * theme provider that tracks VS Code theme changes & MPE preview themes
export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(getCurrentTheme);
  const [previewTheme, setPreviewTheme] = useState<PreviewTheme>('none');
  const [codeBlockTheme, setCodeBlockTheme] = useState<CodeBlockTheme>('auto');
  const [isLight, setIsLight] = useState(true);

  // track VS Code theme changes
  useEffect(() => {
    return onThemeChange(setTheme);
  }, []);

  // inject preview theme CSS when it changes
  useEffect(() => {
    injectPreviewTheme(previewTheme);
  }, [previewTheme]);

  // inject code block theme CSS when it changes
  useEffect(() => {
    injectCodeBlockTheme(codeBlockTheme, isLight);
  }, [codeBlockTheme, isLight]);

  // handler for setting preview theme state from extension
  const setPreviewThemeState = useCallback((state: WebviewThemeState) => {
    setPreviewTheme(state.previewTheme);
    setCodeBlockTheme(state.codeBlockTheme);
    setIsLight(state.isLight);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      isDark: theme === 'dark' || theme === 'high-contrast',
      isHighContrast: theme === 'high-contrast',
      previewTheme,
      codeBlockTheme,
      setPreviewThemeState,
    }),
    [theme, previewTheme, codeBlockTheme, setPreviewThemeState]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

// hook to access the current theme context
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export type { Theme };
export type { PreviewTheme, CodeBlockTheme, WebviewThemeState };
