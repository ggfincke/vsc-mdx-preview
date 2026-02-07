// packages/extension/compiler/shared/rehype/plantuml-placeholder.ts
// convert PlantUML code blocks to placeholders for client-side rendering

import { createDiagramPlaceholder } from './create-diagram-placeholder';

// rehype plugin to transform PlantUML code blocks into placeholder divs
export default createDiagramPlaceholder({
  name: 'plantuml',
  languages: [{ className: 'language-plantuml', id: 'plantuml' }],
  containerClass: 'plantuml-container',
  codeAttr: 'data-plantuml-code',
  idAttr: 'data-plantuml-id',
});
