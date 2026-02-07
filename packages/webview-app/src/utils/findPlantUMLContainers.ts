// packages/webview-app/src/utils/findPlantUMLContainers.ts
// extract PlantUML diagram info from DOM containers

export interface PlantUMLDiagramInfo {
  id: string;
  code: string;
  el: HTMLElement;
}

// find all PlantUML containers w/ data attributes in given root
export function findPlantUMLContainers(
  root: ParentNode
): PlantUMLDiagramInfo[] {
  const results: PlantUMLDiagramInfo[] = [];
  const containers = root.querySelectorAll(
    '.plantuml-container[data-plantuml-code]'
  );

  containers.forEach((el) => {
    const code = el.getAttribute('data-plantuml-code');
    const id = el.getAttribute('data-plantuml-id');
    if (code && id) {
      results.push({ id, code, el: el as HTMLElement });
    }
  });

  return results;
}
