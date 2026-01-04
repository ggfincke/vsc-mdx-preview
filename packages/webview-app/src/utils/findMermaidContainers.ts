// packages/webview-app/src/utils/findMermaidContainers.ts
// extract mermaid diagram info from DOM containers

export interface MermaidDiagramInfo {
  id: string;
  code: string;
  el: HTMLElement;
}

// find all mermaid containers w/ data attributes in given root
export function findMermaidContainers(root: ParentNode): MermaidDiagramInfo[] {
  const results: MermaidDiagramInfo[] = [];
  const containers = root.querySelectorAll(
    '.mermaid-container[data-mermaid-chart]'
  );

  containers.forEach((el) => {
    const code = el.getAttribute('data-mermaid-chart');
    const id = el.getAttribute('data-mermaid-id');
    if (code && id) {
      results.push({ id, code, el: el as HTMLElement });
    }
  });

  return results;
}
