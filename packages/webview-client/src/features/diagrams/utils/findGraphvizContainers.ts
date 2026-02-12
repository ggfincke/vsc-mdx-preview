// packages/webview-app/src/utils/findGraphvizContainers.ts
// extract Graphviz diagram info from DOM containers

import {
  createDiagramContainerFinder,
  type BaseDiagramInfo,
} from './createDiagramContainerFinder';

export interface GraphvizDiagramInfo extends BaseDiagramInfo {
  language: 'dot' | 'graphviz';
}

// find all Graphviz containers w/ data attributes in given root
export const findGraphvizContainers =
  createDiagramContainerFinder<GraphvizDiagramInfo>({
    selector: '.graphviz-container[data-graphviz-code]',
    attributes: {
      codeAttr: 'data-graphviz-code',
      idAttr: 'data-graphviz-id',
    },
    extra: {
      extract: (el) => {
        const language = el.getAttribute('data-graphviz-language');
        if (language === 'dot' || language === 'graphviz') {
          return { language };
        }
        return null;
      },
    },
  });
