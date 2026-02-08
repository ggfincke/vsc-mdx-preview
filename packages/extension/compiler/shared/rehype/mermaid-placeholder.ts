// packages/extension/compiler/shared/rehype/mermaid-placeholder.ts
// convert mermaid code blocks to placeholders for client-side rendering

import { createDiagramPlaceholder } from './create-diagram-placeholder';

// rehype plugin to transform mermaid code blocks into placeholder divs
export default createDiagramPlaceholder({
  name: 'mermaid',
  languages: [{ className: 'language-mermaid', id: 'mermaid' }],
  containerClass: 'mermaid-container',
  codeAttr: 'data-mermaid-chart',
  idAttr: 'data-mermaid-id',
});
