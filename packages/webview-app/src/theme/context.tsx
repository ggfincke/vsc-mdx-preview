// packages/webview-app/src/theme/context.tsx
// React context for theme state - consumes state pushed from extension (server-driven theming)

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import { injectPreviewTheme, injectCodeBlockTheme } from './loader';
import type { PreviewTheme, CodeBlockTheme, WebviewThemeState } from './types';
import {
  getCurrentVSCodeTheme,
  onVSCodeThemeChange,
  type VSCodeTheme,
} from './detection';

interface ThemeContextValue {
  // VS Code theme (detected locally for UI adjustments)
  vsCodeTheme: VSCodeTheme;
  // backward compat: alias for vsCodeTheme
  theme: VSCodeTheme;
  isDark: boolean;
  isHighContrast: boolean;
  // preview theme (pushed from extension)
  previewTheme: PreviewTheme;
  codeBlockTheme: CodeBlockTheme;
  // handler for extension to push theme state
  setPreviewThemeState: (state: WebviewThemeState) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
}

// theme provider that receives theme state from extension
// VS Code theme is detected locally only for UI adjustments (e.g., icon colors)
// preview/code block themes are fully controlled by extension
export function ThemeProvider({ children }: ThemeProviderProps) {
  // VS Code theme detection (local, for UI adjustments only)
  const [vsCodeTheme, setVSCodeTheme] = useState<VSCodeTheme>(getCurrentVSCodeTheme);

  // preview themes (pushed from extension)
  const [previewTheme, setPreviewTheme] = useState<PreviewTheme>('none');
  const [codeBlockTheme, setCodeBlockTheme] = useState<CodeBlockTheme>('auto');
  const [isLight, setIsLight] = useState(true);

  // track VS Code theme changes (local detection for UI only)
  useEffect(() => {
    return onVSCodeThemeChange(setVSCodeTheme);
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

  // backward compat alias
  const value = useMemo<ThemeContextValue>(
    () => ({
      vsCodeTheme,
      theme: vsCodeTheme,
      isDark: vsCodeTheme === 'dark' || vsCodeTheme === 'high-contrast',
      isHighContrast: vsCodeTheme === 'high-contrast',
      previewTheme,
      codeBlockTheme,
      setPreviewThemeState,
    }),
    [vsCodeTheme, previewTheme, codeBlockTheme, setPreviewThemeState]
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
