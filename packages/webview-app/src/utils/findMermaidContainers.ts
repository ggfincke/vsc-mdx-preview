// packages/webview-app/src/utils/findMermaidContainers.ts
// extract mermaid diagram info from DOM containers

import {
  createDiagramContainerFinder,
  type BaseDiagramInfo,
} from './createDiagramContainerFinder';

export type MermaidDiagramInfo = BaseDiagramInfo;

// find all mermaid containers w/ data attributes in given root
export const findMermaidContainers =
  createDiagramContainerFinder<MermaidDiagramInfo>({
    selector: '.mermaid-container[data-mermaid-chart]',
    attributes: {
      codeAttr: 'data-mermaid-chart',
      idAttr: 'data-mermaid-id',
    },
  });
