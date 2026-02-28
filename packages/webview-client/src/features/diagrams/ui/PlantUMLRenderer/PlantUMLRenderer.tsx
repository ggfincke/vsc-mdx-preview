// packages/webview-client/src/features/diagrams/ui/PlantUMLRenderer/PlantUMLRenderer.tsx
// PlantUML renderer - render via extension host proxy to avoid CORS

import { LogTags } from '@mdx-preview/contracts';
import { createDiagramRenderer } from '../DiagramRenderer/createDiagramRenderer';
import { useTheme } from '../../../theme/runtime';
import { ExtensionHandle } from '../../../../platform/rpc/webview-rpc-client';
import { sanitizeSvg } from '../../utils/sanitizeSvg';
import './PlantUMLRenderer.css';

interface PlantUMLProps {
  code: string;
  id: string;
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
