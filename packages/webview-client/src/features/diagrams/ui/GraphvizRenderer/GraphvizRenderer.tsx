// packages/webview-app/src/components/GraphvizRenderer/GraphvizRenderer.tsx
// lazy Graphviz renderer w/ client-side DOT to SVG conversion

import DOMPurify from 'dompurify';
import { LogTags } from '@mdx-preview/shared';
import { createDiagramRenderer } from '../DiagramRenderer/createDiagramRenderer';
import { useTheme } from '../../../theme/runtime';
import { DOMPURIFY_CONFIG } from '../../../preview/safe/security/allowlist';
import './GraphvizRenderer.css';

type VizModule = typeof import('@viz-js/viz');
type VizInstance = Awaited<ReturnType<VizModule['instance']>>;

interface GraphvizProps {
  code: string;
  id: string;
  language: 'dot' | 'graphviz';
}

// lazy-load Graphviz engine (WASM) once
let vizInstancePromise: Promise<VizInstance> | null = null;

function getVizInstance(): Promise<VizInstance> {
  if (!vizInstancePromise) {
    vizInstancePromise = import('@viz-js/viz').then((mod) => mod.instance());
  }
  return vizInstancePromise;
}

// sanitize rendered SVG before inserting into DOM
function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, DOMPURIFY_CONFIG) as string;
}

// render a single Graphviz diagram w/ error handling
export const GraphvizRenderer = createDiagramRenderer<GraphvizProps>({
  classPrefix: 'mdx-preview-graphviz',
  errorLabel: 'Graphviz render error',
  loadingText: 'Rendering diagram...',
  logTag: LogTags.GRAPHVIZ_RENDERER,
  useThemeValue: () => (useTheme().isDark ? 'dark' : 'light'),
  sanitize: sanitizeSvg,
  extraDeps: (props) => [props.language],
  render: async (props, signal) => {
    const viz = await getVizInstance();

    if (signal.isCancelled()) {
      return '';
    }

    // colors set as defaults; dark mode overrides via CSS (!important)
    return viz.renderString(props.code, {
      format: 'svg',
      engine: 'dot',
      graphAttributes: {
        bgcolor: 'transparent',
        fontname: 'sans-serif',
      },
      nodeAttributes: {
        fontname: 'sans-serif',
      },
      edgeAttributes: {
        fontname: 'sans-serif',
      },
    });
  },
});

