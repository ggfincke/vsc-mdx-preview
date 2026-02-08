// packages/webview-app/src/utils/createDiagramContainerFinder.ts
// factory for creating diagram container DOM discovery functions

// base diagram info shared by all diagram types
export interface BaseDiagramInfo {
  id: string;
  code: string;
  el: HTMLElement;
}

// attribute mapping for code & id data attributes
interface DiagramAttributeConfig {
  // data attribute name for code content (e.g., 'data-mermaid-chart')
  codeAttr: string;
  // data attribute name for diagram ID (e.g., 'data-mermaid-id')
  idAttr: string;
}

// configuration for extra fields beyond id/code/el
interface ExtraFieldConfig<T extends BaseDiagramInfo> {
  // extract extra fields from the DOM element (return null to skip element)
  extract: (el: Element) => Partial<T> | null;
}

// configuration for creating a diagram container finder
export interface DiagramContainerFinderConfig<T extends BaseDiagramInfo> {
  // CSS selector for the container (e.g., '.mermaid-container[data-mermaid-chart]')
  selector: string;
  // attribute names for code & id
  attributes: DiagramAttributeConfig;
  // optional extra field extraction (return null to skip element)
  extra?: ExtraFieldConfig<T>;
}

// create a typed finder function for diagram containers
export function createDiagramContainerFinder<T extends BaseDiagramInfo>(
  config: DiagramContainerFinderConfig<T>
): (root: ParentNode) => T[] {
  return (root: ParentNode): T[] => {
    const results: T[] = [];
    const containers = root.querySelectorAll(config.selector);

    containers.forEach((el) => {
      const code = el.getAttribute(config.attributes.codeAttr);
      const id = el.getAttribute(config.attributes.idAttr);
      if (!code || !id) {
        return;
      }

      // build base info
      const base = { id, code, el: el as HTMLElement } as T;

      // extract & validate extra fields if configured
      if (config.extra) {
        const extraFields = config.extra.extract(el);
        if (!extraFields) {
          return;
        }
        Object.assign(base, extraFields);
      }

      results.push(base);
    });

    return results;
  };
}
