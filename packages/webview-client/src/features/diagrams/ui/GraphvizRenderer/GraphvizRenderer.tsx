// packages/webview-client/src/features/diagrams/ui/GraphvizRenderer/GraphvizRenderer.tsx
// lazy Graphviz renderer w/ client-side DOT to SVG conversion

import { LogTags } from '@mdx-preview/contracts';
import { createDiagramRenderer } from '../DiagramRenderer/createDiagramRenderer';
import { useTheme } from '../../../theme/runtime';
import { loadGraphvizInstance } from '../../utils/graphvizLoader';
import { sanitizeSvg } from '../../utils/sanitizeSvg';
import './GraphvizRenderer.css';

interface GraphvizProps {
  code: string;
  id: string;
  language: 'dot' | 'graphviz';
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
    const viz = await loadGraphvizInstance();

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
