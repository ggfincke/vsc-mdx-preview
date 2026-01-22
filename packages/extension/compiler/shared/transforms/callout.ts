// packages/extension/compiler/shared/transforms/callout.ts
// transform Callout/Alert/Admonition components to semantic HTML

import type { RootContent } from 'mdast';
import type { MdxJsxElement } from './types';
import { getStaticStringProp, escapeHtml, createNode } from './utils';
import { ADMONITION_ICONS } from '../icon-registry';

export type CalloutType =
  | 'note'
  | 'tip'
  | 'warning'
  | 'danger'
  | 'info'
  | 'caution'
  | 'important';

export const CALLOUT_DEFAULTS: Record<
  CalloutType,
  { label: string; className: string; icon: string }
> = {
  note: {
    label: 'Note',
    className: 'mdx-safe-callout-note',
    icon: ADMONITION_ICONS.note,
  },
  info: {
    label: 'Info',
    className: 'mdx-safe-callout-info',
    icon: ADMONITION_ICONS.info,
  },
  tip: {
    label: 'Tip',
    className: 'mdx-safe-callout-tip',
    icon: ADMONITION_ICONS.tip,
  },
  warning: {
    label: 'Warning',
    className: 'mdx-safe-callout-warning',
    icon: ADMONITION_ICONS.warning,
  },
  caution: {
    label: 'Caution',
    className: 'mdx-safe-callout-caution',
    icon: ADMONITION_ICONS.caution,
  },
  danger: {
    label: 'Danger',
    className: 'mdx-safe-callout-danger',
    icon: ADMONITION_ICONS.danger,
  },
  important: {
    label: 'Important',
    className: 'mdx-safe-callout-important',
    icon: ADMONITION_ICONS.important,
  },
};

// normalize callout type string to canonical type
// maps common aliases (success→tip, error→danger, warn→warning, hint→tip)
export function normalizeCalloutType(type: string | undefined): CalloutType {
  if (!type) {
    return 'note';
  }
  const normalized = type.toLowerCase();
  switch (normalized) {
    case 'success':
      return 'tip';
    case 'error':
      return 'danger';
    case 'warn':
      return 'warning';
    case 'hint':
      return 'tip';
    default:
      if (
        [
          'note',
          'tip',
          'warning',
          'danger',
          'info',
          'caution',
          'important',
        ].includes(normalized)
      ) {
        return normalized as CalloutType;
      }
      return 'note';
  }
}

// transform Callout/Alert/Admonition component to semantic HTML
export function transformCallout(node: MdxJsxElement): RootContent {
  const typeStr = getStaticStringProp(node, 'type');
  const calloutType = normalizeCalloutType(typeStr);
  const config = CALLOUT_DEFAULTS[calloutType];
  const title = getStaticStringProp(node, 'title') || config.label;

  return createNode({
    type: 'callout',
    hName: 'aside',
    className: ['mdx-safe-callout', config.className],
    additionalProps: { 'data-callout-type': calloutType },
    children: [
      createNode({
        type: 'calloutHeader',
        hName: 'div',
        className: 'mdx-safe-callout-header',
        children: [
          {
            type: 'html',
            value: `<span class="mdx-safe-callout-icon">${config.icon}</span>`,
          },
          { type: 'text', value: escapeHtml(title) },
        ],
      }),
      createNode({
        type: 'calloutContent',
        hName: 'div',
        className: 'mdx-safe-callout-content',
        children: node.children,
      }),
    ],
  }) as RootContent;
}
