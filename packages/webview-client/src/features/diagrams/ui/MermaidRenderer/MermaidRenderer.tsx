// packages/webview-client/src/features/diagrams/ui/MermaidRenderer/MermaidRenderer.tsx
// lazy-loaded mermaid diagram renderer w/ error handling & source toggle

import {
  LogTags,
  MERMAID_THEMES,
  type MermaidTheme,
} from '@mdx-preview/contracts';
import { createDiagramRenderer } from '../DiagramRenderer/createDiagramRenderer';
import { useTheme } from '../../../theme/runtime';
import { useEffect } from 'react';
import { loadMermaid } from '../../utils/mermaidLoader';
import {
  registerBuiltinIconPacks,
  registerDynamicIconPacks,
  setPendingDynamicPacks,
  getPendingDynamicPacks,
  getMermaidIconPacksFingerprint,
} from '../../utils/mermaidIconPacks';
import './MermaidRenderer.css';

// read the mermaid theme
function useMermaidThemeValue(): MermaidTheme {
  return useTheme().mermaidTheme;
}

function isMermaidTheme(theme: string): theme is MermaidTheme {
  return MERMAID_THEMES.some((candidate) => candidate === theme);
}

// keep icon packs in sync & expose their content fingerprint to the cache
function useMermaidIconPacksFingerprint(): string {
  const { mermaidIconPacks } = useTheme();
  useEffect(() => {
    setPendingDynamicPacks(mermaidIconPacks);
  }, [mermaidIconPacks]);
  return getMermaidIconPacksFingerprint(mermaidIconPacks);
}

// check if mermaid theme is dark (needs dark background)
function isDarkMermaidTheme(theme: string): boolean {
  return theme === 'dark';
}

// cache for mermaid initialization - avoid re-initializing w/ same config
let lastInitializedTheme: string | null = null;
let lastInitializedDark: boolean | null = null;

interface MermaidProps {
  code: string;
  id: string;
}

// render a single mermaid diagram w/ error handling
export const MermaidRenderer = createDiagramRenderer<MermaidProps>({
  cacheFamily: 'mermaid',
  classPrefix: 'mdx-preview-mermaid',
  errorLabel: 'Mermaid parse error',
  loadingText: 'Loading diagram...',
  logTag: LogTags.MERMAID_RENDERER,
  useThemeValue: useMermaidThemeValue,
  useCacheKeyValue: useMermaidIconPacksFingerprint,
  includeIdInCacheKey: true,
  toDataTheme: (theme) => (isDarkMermaidTheme(theme) ? 'dark' : 'light'),
  render: async (_props, signal, mermaidTheme) => {
    const { code, id } = _props;
    const theme = isMermaidTheme(mermaidTheme) ? mermaidTheme : 'default';
    const isDark = isDarkMermaidTheme(theme);

    const mermaid = await loadMermaid();

    // register icon packs (idempotent) so architecture-beta diagrams can use
    // icons like logos:aws-lambda or user-configured packs
    registerBuiltinIconPacks(mermaid);
    registerDynamicIconPacks(mermaid, getPendingDynamicPacks());

    // only re-initialize if theme or dark state changed (perf optimization)
    const needsReinit =
      lastInitializedTheme !== theme || lastInitializedDark !== isDark;

    if (needsReinit) {
      // initialize mermaid w/ strict config (no foreignObject)
      // theme is controlled by user setting (mdx-preview.preview.mermaidTheme)
      mermaid.default.initialize({
        startOnLoad: false,
        theme,
        securityLevel: 'strict',
        // disable HTML labels at the root so node labels render as pure SVG text
        // the flowchart-scoped flag is deprecated & ignored; mermaid's root
        // htmlLabels defaults true, so foreignObject leaks through w/o this
        htmlLabels: false,
        sequence: { useMaxWidth: true },
        // fix ER diagram relationship label contrast
        themeCSS: `
          .edgeLabel text,
          .edgeLabel tspan,
          .edgeLabel span,
          .edgeLabel .label text,
          .edgeLabel .label tspan,
          .edgeLabel .label span,
          .edgeLabel foreignObject div {
            fill: ${isDark ? '#fff' : '#000'} !important;
            color: ${isDark ? '#fff' : '#000'} !important;
          }
          .relationshipLabelBox,
          .relationshipLabelBox rect,
          .edgeLabel .label rect.background {
            fill: ${isDark ? '#1e1e1e' : '#ffffff'} !important;
            stroke: ${isDark ? '#555' : '#ccc'} !important;
            stroke-width: 1px !important;
            opacity: 1 !important;
          }
        `,
      });
      lastInitializedTheme = theme;
      lastInitializedDark = isDark;
    }

    if (signal.isCancelled()) {
      return '';
    }

    // render diagram to SVG
    const { svg } = await mermaid.default.render(`mermaid-svg-${id}`, code);
    return svg;
  },
});
