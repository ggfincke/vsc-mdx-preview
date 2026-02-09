// packages/extension/compiler/shared/rehype/graphviz-placeholder.ts
// convert Graphviz code blocks to placeholders for client-side rendering

import { createDiagramPlaceholder } from './create-diagram-placeholder';

// rehype plugin to transform Graphviz code blocks into placeholder divs
export default createDiagramPlaceholder({
  name: 'graphviz',
  languages: [
    { className: 'language-dot', id: 'dot' },
    { className: 'language-graphviz', id: 'graphviz' },
  ],
  containerClass: 'graphviz-container',
  codeAttr: 'data-graphviz-code',
  idAttr: 'data-graphviz-id',
  extraAttributes: (lang) => ({ 'data-graphviz-language': lang }),
});
