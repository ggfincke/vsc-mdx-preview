// packages/webview-app/src/utils/findGraphvizContainers.ts
// extract Graphviz diagram info from DOM containers

export interface GraphvizDiagramInfo {
  id: string;
  code: string;
  language: 'dot' | 'graphviz';
  el: HTMLElement;
}

// find all Graphviz containers w/ data attributes in given root
export function findGraphvizContainers(
  root: ParentNode
): GraphvizDiagramInfo[] {
  const results: GraphvizDiagramInfo[] = [];
  const containers = root.querySelectorAll(
    '.graphviz-container[data-graphviz-code]'
  );

  containers.forEach((el) => {
    const code = el.getAttribute('data-graphviz-code');
    const id = el.getAttribute('data-graphviz-id');
    const language = el.getAttribute('data-graphviz-language');
    if (code && id && (language === 'dot' || language === 'graphviz')) {
      results.push({ id, code, language, el: el as HTMLElement });
    }
  });

  return results;
}
