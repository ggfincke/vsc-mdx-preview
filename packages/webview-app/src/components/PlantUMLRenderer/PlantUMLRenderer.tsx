// packages/webview-app/src/components/PlantUMLRenderer/PlantUMLRenderer.tsx
// PlantUML renderer - render via extension host proxy to avoid CORS

import DOMPurify from 'dompurify';
import { LogTags } from '@mdx-preview/shared';
import { createDiagramRenderer } from '../DiagramRenderer/createDiagramRenderer';
import { useTheme } from '../../theme';
import { ExtensionHandle } from '../../rpc-webview';
import { DOMPURIFY_CONFIG } from '../../security/allowlist';
import './PlantUMLRenderer.css';

interface PlantUMLProps {
  code: string;
  id: string;
}

// sanitize rendered SVG before inserting into DOM
function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, DOMPURIFY_CONFIG) as string;
}

// render a single PlantUML diagram w/ error handling
export const PlantUMLRenderer = createDiagramRenderer<PlantUMLProps>({
  classPrefix: 'mdx-preview-plantuml',
  errorLabel: 'PlantUML render error',
  loadingText: 'Rendering diagram...',
  logTag: LogTags.PLANTUML_RENDERER,
  useThemeValue: () => (useTheme().isDark ? 'dark' : 'light'),
  sanitize: sanitizeSvg,
  render: async (props) => {
    // render via extension host proxy (avoids CORS restrictions)
    const svg = await ExtensionHandle.renderPlantUml(props.code);

    if (!svg) {
      throw new Error('Failed to render diagram');
    }

    return svg;
  },
});

