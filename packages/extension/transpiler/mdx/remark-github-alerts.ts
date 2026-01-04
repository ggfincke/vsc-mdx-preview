// packages/extension/transpiler/mdx/remark-github-alerts.ts
// * custom remark plugin for GitHub-style blockquote alerts ([!NOTE], [!WARNING], etc.)

import { visit } from 'unist-util-visit';
import type { Root, Blockquote, Paragraph, Text, Html } from 'mdast';
import type { Parent } from 'unist';

// alert type configuration
const ALERT_CONFIG = {
  NOTE: {
    className: 'note',
    label: 'Note',
    // info circle icon
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>',
  },
  TIP: {
    className: 'tip',
    label: 'Tip',
    // lightbulb icon
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z"></path></svg>',
  },
  IMPORTANT: {
    className: 'important',
    label: 'Important',
    // report icon
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path></svg>',
  },
  WARNING: {
    className: 'warning',
    label: 'Warning',
    // alert triangle icon
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path></svg>',
  },
  CAUTION: {
    className: 'caution',
    label: 'Caution',
    // stop/octagon icon
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>',
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

      // replace the blockquote with our alert HTML
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
