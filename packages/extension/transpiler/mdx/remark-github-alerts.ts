// packages/extension/transpiler/mdx/remark-github-alerts.ts
// * custom remark plugin for GitHub-style blockquote alerts ([!NOTE], [!WARNING], etc.)

import { visit } from 'unist-util-visit';
import type { Root, Blockquote, Paragraph, Text, Html } from 'mdast';
import type { Parent } from 'unist';
import { GITHUB_ALERT_ICONS } from './icon-registry';

// alert type configuration
const ALERT_CONFIG = {
  NOTE: {
    className: 'note',
    label: 'Note',
    icon: GITHUB_ALERT_ICONS.NOTE,
  },
  TIP: {
    className: 'tip',
    label: 'Tip',
    icon: GITHUB_ALERT_ICONS.TIP,
  },
  IMPORTANT: {
    className: 'important',
    label: 'Important',
    icon: GITHUB_ALERT_ICONS.IMPORTANT,
  },
  WARNING: {
    className: 'warning',
    label: 'Warning',
    icon: GITHUB_ALERT_ICONS.WARNING,
  },
  CAUTION: {
    className: 'caution',
    label: 'Caution',
    icon: GITHUB_ALERT_ICONS.CAUTION,
  },
} as const;

type AlertType = keyof typeof ALERT_CONFIG;

// match [!TYPE] at start of first paragraph in blockquote
const ALERT_REGEX = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i;

// * remark plugin that transforms GitHub-style blockquote alerts
export default function remarkGithubAlerts() {
  return (tree: Root) => {
    visit(tree, 'blockquote', (node: Blockquote, index, parent) => {
      if (index === undefined || parent === undefined) {
        return;
      }

      // check if first child is a paragraph
      const firstChild = node.children[0];
      if (!firstChild || firstChild.type !== 'paragraph') {
        return;
      }

      // check if paragraph starts w/ [!TYPE]
      const paragraph = firstChild as Paragraph;
      const firstTextNode = paragraph.children[0];
      if (!firstTextNode || firstTextNode.type !== 'text') {
        return;
      }

      const text = firstTextNode as Text;
      const match = text.value.match(ALERT_REGEX);
      if (!match) {
        return;
      }

      const alertType = match[1].toUpperCase() as AlertType;
      const config = ALERT_CONFIG[alertType];

      // remove the [!TYPE] prefix from text
      text.value = text.value.replace(ALERT_REGEX, '');

      // if the text is now empty, remove the text node
      if (text.value === '') {
        paragraph.children.shift();
      }

      // if paragraph is now empty (only had [!TYPE]), remove it
      if (paragraph.children.length === 0) {
        node.children.shift();
      }

      // build the alert HTML structure
      // we use raw HTML nodes since this is simpler than building MDAST for div structure
      const alertHtml: Html = {
        type: 'html',
        value: buildAlertHtml(config, node),
      };

      // replace the blockquote w/ our alert HTML
      (parent as Parent).children[index] = alertHtml;
    });
  };
}

// build HTML string for alert (cleaner than complex MDAST manipulation)
function buildAlertHtml(
  config: (typeof ALERT_CONFIG)[AlertType],
  node: Blockquote
): string {
  // convert blockquote children to simple text content
  // this is a simplified approach - we extract text from remaining children
  const contentParts: string[] = [];

  for (const child of node.children) {
    if (child.type === 'paragraph') {
      const textContent = extractTextContent(child);
      if (textContent) {
        contentParts.push(`<p>${escapeHtml(textContent)}</p>`);
      }
    }
  }

  const content = contentParts.join('\n');

  return `<div class="github-alert github-alert-${config.className}" role="note">
<p class="github-alert-title">${config.icon}<span>${config.label}</span></p>
<div class="github-alert-content">
${content}
</div>
</div>`;
}

// extract text content from paragraph (simplified - handle basic text nodes)
function extractTextContent(paragraph: Paragraph): string {
  const parts: string[] = [];

  for (const child of paragraph.children) {
    if (child.type === 'text') {
      parts.push(child.value);
    } else if (child.type === 'strong' || child.type === 'emphasis') {
      // recursively get text from formatted nodes
      const innerText = child.children
        .filter((c): c is Text => c.type === 'text')
        .map((c) => c.value)
        .join('');
      parts.push(innerText);
    } else if (child.type === 'inlineCode') {
      parts.push(child.value);
    }
  }

  return parts.join('');
}

// escape HTML special characters
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
