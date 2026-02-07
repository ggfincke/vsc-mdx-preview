// packages/extension/compiler/shared/rehype/create-diagram-placeholder.ts
// factory for creating rehype diagram placeholder plugins

import { visit } from 'unist-util-visit';
import type { Root, Element, Text } from 'hast';

// language alias configuration for a diagram type
interface LanguageAlias {
  // CSS class name to match (e.g., 'language-mermaid')
  className: string;
  // canonical language identifier (e.g., 'mermaid')
  id: string;
}

// configuration for a diagram placeholder plugin
export interface DiagramPlaceholderConfig {
  // diagram type name used for ID prefix (e.g., 'mermaid')
  name: string;
  // language aliases to match against code block classes
  languages: LanguageAlias[];
  // CSS class for the container div (e.g., 'mermaid-container')
  containerClass: string;
  // data attribute name for the code content (e.g., 'data-mermaid-chart')
  codeAttr: string;
  // data attribute name for the diagram ID (e.g., 'data-mermaid-id')
  idAttr: string;
  // optional extra attributes derived from matched language
  extraAttributes?: (languageId: string) => Record<string, string>;
}

// collect raw code text from all text children of a code node
function getCodeText(node: Element): string {
  return node.children
    .map((child) => {
      if (child.type === 'text') {
        return (child as Text).value;
      }
      return '';
    })
    .join('');
}

// detect matching language class & return canonical language id
function matchLanguage(
  classNames: Array<string | number>,
  languages: LanguageAlias[]
): string | null {
  for (const lang of languages) {
    if (classNames.some((c) => String(c) === lang.className)) {
      return lang.id;
    }
  }
  return null;
}

// create a rehype plugin that transforms code blocks into placeholder divs
export function createDiagramPlaceholder(config: DiagramPlaceholderConfig) {
  return function rehypeDiagramPlaceholder() {
    return (tree: Root) => {
      visit(tree, 'element', (node: Element, index, parent) => {
        if (node.tagName !== 'pre') {
          return;
        }

        const codeChild = node.children[0];
        if (
          !codeChild ||
          codeChild.type !== 'element' ||
          codeChild.tagName !== 'code'
        ) {
          return;
        }

        // normalize className to array
        const className = codeChild.properties?.className;
        const classNames = Array.isArray(className)
          ? className
          : typeof className === 'string'
            ? [className]
            : [];

        // check for matching language class
        const languageId = matchLanguage(classNames, config.languages);
        if (!languageId) {
          return;
        }

        const code = getCodeText(codeChild);
        if (!code.trim()) {
          return;
        }

        // generate unique ID for this diagram
        const diagramId = `${config.name}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        // build placeholder properties
        const properties: Record<string, string | string[]> = {
          className: [config.containerClass],
          [config.codeAttr]: code,
          [config.idAttr]: diagramId,
        };

        // merge extra attributes if configured
        if (config.extraAttributes) {
          Object.assign(properties, config.extraAttributes(languageId));
        }

        // replace pre/code w/ placeholder div
        const placeholder: Element = {
          type: 'element',
          tagName: 'div',
          properties,
          children: [],
        };

        if (parent && typeof index === 'number') {
          (parent as Element).children[index] = placeholder;
        }
      });
    };
  };
}
