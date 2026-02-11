// packages/webview-app/src/components/GraphvizRenderer/GraphvizRenderer.tsx
// lazy Graphviz renderer w/ client-side DOT to SVG conversion

import { LogTags } from '@mdx-preview/contracts';
import { createDiagramRenderer } from '../DiagramRenderer/createDiagramRenderer';
import { useTheme } from '../../../theme/runtime';
import { sanitizeSvg } from '../../utils/sanitizeSvg';
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
