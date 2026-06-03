// packages/webview-client/src/features/theme/runtime/context.tsx
// React context for theme state - consumes state pushed from extension (server-driven theming)

import { useState, useEffect, useMemo, useCallback } from 'react';
import { injectPreviewTheme, injectCodeBlockTheme } from './loader';
import { DEFAULT_PLANTUML_SERVER } from '@mdx-preview/contracts';
import type {
  CodeBlockTheme,
  MermaidTheme,
  PreviewTheme,
  ResolvedMermaidIconPack,
  WebviewThemeState,
} from '@mdx-preview/contracts';
import {
  getCurrentVSCodeTheme,
  onVSCodeThemeChange,
  type VSCodeTheme,
} from './detection';
import { createContextProvider } from '../../../app/providers/createContextProvider';

interface ThemeContextValue {
  // VS Code theme (detected locally for UI adjustments)
  vsCodeTheme: VSCodeTheme;
  isDark: boolean;
  isHighContrast: boolean;
  // preview theme (pushed from extension)
  previewTheme: PreviewTheme;
  codeBlockTheme: CodeBlockTheme;
  mermaidTheme: MermaidTheme;
  plantUmlServer: string;
  mermaidIconPacks: ResolvedMermaidIconPack[];
  // handler for extension to push theme state
  setPreviewThemeState: (state: WebviewThemeState) => void;
}

// build theme context value from extension payloads & local VS Code theme state
function useThemeValue(): ThemeContextValue {
  // VS Code theme detection (local, for UI adjustments only)
  const [vsCodeTheme, setVSCodeTheme] = useState<VSCodeTheme>(
    getCurrentVSCodeTheme
  );

  // preview themes (pushed from extension)
  const [previewTheme, setPreviewTheme] = useState<PreviewTheme>('none');
  const [codeBlockTheme, setCodeBlockTheme] = useState<CodeBlockTheme>('auto');
  const [mermaidTheme, setMermaidTheme] = useState<MermaidTheme>('default');
  const [plantUmlServer, setPlantUmlServer] = useState<string>(
    DEFAULT_PLANTUML_SERVER
  );
  const [mermaidIconPacks, setMermaidIconPacks] = useState<
    ResolvedMermaidIconPack[]
  >([]);
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
    setMermaidTheme(state.mermaidTheme);
    setIsLight(state.isLight);
    setPlantUmlServer(state.plantUmlServer);
    setMermaidIconPacks(state.mermaidIconPacks);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      vsCodeTheme,
      isDark: vsCodeTheme === 'dark' || vsCodeTheme === 'high-contrast',
      isHighContrast: vsCodeTheme === 'high-contrast',
      previewTheme,
      codeBlockTheme,
      mermaidTheme,
      plantUmlServer,
      mermaidIconPacks,
      setPreviewThemeState,
    }),
    [
      vsCodeTheme,
      previewTheme,
      codeBlockTheme,
      mermaidTheme,
      plantUmlServer,
      mermaidIconPacks,
      setPreviewThemeState,
    ]
  );

  return value;
}

const { Provider, useContextValue } = createContextProvider<ThemeContextValue>(
  'Theme',
  useThemeValue
);

export const ThemeProvider = Provider;
export const useTheme = useContextValue;
