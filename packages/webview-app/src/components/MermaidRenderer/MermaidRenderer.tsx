// packages/webview-app/src/components/MermaidRenderer/MermaidRenderer.tsx
// lazy-loaded mermaid diagram renderer w/ error handling & source toggle

import { LogTags } from '@mdx-preview/shared';
import { createDiagramRenderer } from '../DiagramRenderer/createDiagramRenderer';
import { useTheme } from '../../theme';
import './MermaidRenderer.css';

// lazy-load mermaid (heavy ~2MB, only load when needed)
let mermaidPromise: Promise<typeof import('mermaid')> | null = null;

function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid');
  }
  return mermaidPromise;
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
  classPrefix: 'mdx-preview-mermaid',
  errorLabel: 'Mermaid parse error',
  loadingText: 'Loading diagram...',
  logTag: LogTags.MERMAID_RENDERER,
  useThemeValue: () => useTheme().mermaidTheme,
  toDataTheme: (theme) => (isDarkMermaidTheme(theme) ? 'dark' : 'light'),
  render: async (_props, signal, mermaidTheme) => {
    const { code, id } = _props;
    const isDark = isDarkMermaidTheme(mermaidTheme);

    const mermaid = await getMermaid();

    // only re-initialize if theme or dark state changed (perf optimization)
    const needsReinit =
      lastInitializedTheme !== mermaidTheme ||
      lastInitializedDark !== isDark;

    if (needsReinit) {
      // initialize mermaid w/ strict config (no foreignObject)
      // theme is controlled by user setting (mdx-preview.preview.mermaidTheme)
      mermaid.default.initialize({
        startOnLoad: false,
        theme: mermaidTheme,
        securityLevel: 'strict',
        // disable HTML labels to produce pure SVG (no foreignObject)
        // this keeps DOMPurify allowlist tighter
        flowchart: { htmlLabels: false },
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
      lastInitializedTheme = mermaidTheme;
      lastInitializedDark = isDark;
    }

    if (signal.isCancelled()) {
      return '';
    }

    // render diagram to SVG
    const { svg } = await mermaid.default.render(
      `mermaid-svg-${id}`,
      code
    );
    return svg;
  },
});

