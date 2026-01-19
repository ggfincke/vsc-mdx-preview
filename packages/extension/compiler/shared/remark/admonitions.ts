// packages/extension/compiler/shared/remark/admonitions.ts
// remark plugin to transform directive syntax (:::note, :::warning, etc.) to admonition HTML
//
// this plugin transforms container directives from remark-directive into admonition HTML.
// it supports Docusaurus/Starlight-style admonition syntax:
//
//   :::note
//   this is a note
//   :::
//
//   :::warning[Custom Title]
//   this is a warning w/ a custom title
//   :::

import { visit } from 'unist-util-visit';
import type { Root, Parent, PhrasingContent, BlockContent } from 'mdast';
import type { ContainerDirective } from 'mdast-util-directive';
import { ADMONITION_ICONS } from '../icon-registry';

// admonition type configuration
interface AdmonitionType {
  className: string;
  label: string;
  icon: string;
}

// supported admonition types (Docusaurus + Starlight compatible)
// CSS naming convention: mdx-preview-admonition-*
const ADMONITION_TYPES: Record<string, AdmonitionType> = {
  note: {
    className: 'mdx-preview-admonition-note',
    label: 'Note',
    icon: ADMONITION_ICONS.note,
  },
  tip: {
    className: 'mdx-preview-admonition-tip',
    label: 'Tip',
    icon: ADMONITION_ICONS.tip,
  },
  info: {
    className: 'mdx-preview-admonition-info',
    label: 'Info',
    icon: ADMONITION_ICONS.info,
  },
  warning: {
    className: 'mdx-preview-admonition-warning',
    label: 'Warning',
    icon: ADMONITION_ICONS.warning,
  },
  danger: {
    className: 'mdx-preview-admonition-danger',
    label: 'Danger',
    icon: ADMONITION_ICONS.danger,
  },
  caution: {
    className: 'mdx-preview-admonition-caution',
    label: 'Caution',
    icon: ADMONITION_ICONS.caution,
  },
  important: {
    className: 'mdx-preview-admonition-important',
    label: 'Important',
    icon: ADMONITION_ICONS.important,
  },
};

// type guard for container directive
function isContainerDirective(node: unknown): node is ContainerDirective {
  return (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    node.type === 'containerDirective'
  );
}

// extract custom title from directive children
// e.g., :::note[Custom Title] creates a directiveLabel node
function extractCustomTitle(node: ContainerDirective): string | null {
  // check attributes first (some parsers put it there)
  if (node.attributes && 'title' in node.attributes) {
    return node.attributes.title as string;
  }

  // check for directiveLabel in data
  const data = node.data as { directiveLabel?: boolean } | undefined;
  if (data?.directiveLabel) {
    // the label is in the first child if it's a paragraph w/ directiveLabel
    const firstChild = node.children?.[0];
    if (
      firstChild &&
      'type' in firstChild &&
      firstChild.type === 'paragraph' &&
      'data' in firstChild &&
      (firstChild.data as { directiveLabel?: boolean })?.directiveLabel
    ) {
      // extract text content from the label paragraph
      const labelNode = firstChild as Parent;
      const textContent = labelNode.children
        ?.filter(
          (child): child is { type: 'text'; value: string } =>
            'type' in child && child.type === 'text'
        )
        .map((child) => child.value)
        .join('');
      return textContent || null;
    }
  }

  // check for [Title] syntax in name
  const nameMatch = node.name?.match(/^(\w+)\[(.+)\]$/);
  if (nameMatch) {
    return nameMatch[2];
  }

  return null;
}

// get the directive name without custom title
function getDirectiveName(node: ContainerDirective): string {
  if (!node.name) {
    return '';
  }

  // handle :::note[Title] syntax
  const nameMatch = node.name.match(/^(\w+)(?:\[.+\])?$/);
  if (nameMatch) {
    return nameMatch[1].toLowerCase();
  }

  return node.name.toLowerCase();
}

// create HTML AST node for admonition
function createAdmonitionNode(
  type: AdmonitionType,
  title: string,
  children: Array<BlockContent | PhrasingContent>
): Parent {
  // filter out directive label from children if present
  const contentChildren = children.filter((child) => {
    if ('data' in child) {
      const data = child.data as { directiveLabel?: boolean } | undefined;
      return !data?.directiveLabel;
    }
    return true;
  });

  return {
    type: 'admonition' as any, // custom type that will be converted to HTML
    data: {
      hName: 'div',
      hProperties: {
        className: ['mdx-preview-admonition', type.className],
        'data-admonition-type': type.label.toLowerCase(),
      },
    },
    children: [
      {
        type: 'admonitionHeader' as any,
        data: {
          hName: 'div',
          hProperties: {
            className: ['mdx-preview-admonition-header'],
          },
        },
        children: [
          {
            type: 'html' as any,
            value: `<span class="mdx-preview-admonition-icon">${type.icon}</span>`,
          },
          {
            type: 'text',
            value: title,
          } as any,
        ],
      } as any,
      {
        type: 'admonitionContent' as any,
        data: {
          hName: 'div',
          hProperties: {
            className: ['mdx-preview-admonition-content'],
          },
        },
        children: contentChildren,
      } as any,
    ],
  } as any;
}

// remark plugin to transform container directives to admonitions
export default function remarkAdmonitions() {
  return (tree: Root) => {
    visit(
      tree,
      (node: unknown): node is ContainerDirective => isContainerDirective(node),
      (
        node: ContainerDirective,
        index: number | undefined,
        parent: Parent | undefined
      ) => {
        if (index === undefined || !parent) {
          return;
        }

        const directiveName = getDirectiveName(node);

        // check if this is a supported admonition type
        const admonitionType = ADMONITION_TYPES[directiveName];
        if (!admonitionType) {
          // not an admonition directive, leave it alone
          return;
        }

        // extract custom title or use default
        const customTitle = extractCustomTitle(node);
        const title = customTitle || admonitionType.label;

        // create admonition node
        const admonitionNode = createAdmonitionNode(
          admonitionType,
          title,
          node.children as Array<BlockContent | PhrasingContent>
        );

        // replace the directive node w/ the admonition node
        parent.children.splice(
          index,
          1,
          admonitionNode as (typeof parent.children)[number]
        );
      }
    );
  };
}
