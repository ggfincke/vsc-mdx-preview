// packages/extension/compiler/shared/transforms/callout.ts
// transform Callout/Alert/Admonition components to semantic HTML

import type { RootContent } from 'mdast';
import type { MdxJsxElement } from '../../types';
import { getStaticStringProp, escapeHtml, createNode } from './utils';
import { ADMONITION_ICONS } from '../common/icon-registry';
import {
  type CalloutType,
  CALLOUT_TITLES,
  normalizeCalloutType,
} from '../../../internal/callout';

// re-export for consumers that import from this file
export {
  type CalloutType,
  normalizeCalloutType,
} from '../../../internal/callout';

// callout defaults w/ icons & CSS class names for Safe Mode HTML rendering
export const CALLOUT_DEFAULTS: Record<
  CalloutType,
  { label: string; className: string; icon: string }
> = {
  note: {
    label: CALLOUT_TITLES.note,
    className: 'mdx-safe-callout-note',
    icon: ADMONITION_ICONS.note,
  },
  info: {
    label: CALLOUT_TITLES.info,
    className: 'mdx-safe-callout-info',
    icon: ADMONITION_ICONS.info,
  },
  tip: {
    label: CALLOUT_TITLES.tip,
    className: 'mdx-safe-callout-tip',
    icon: ADMONITION_ICONS.tip,
  },
  warning: {
    label: CALLOUT_TITLES.warning,
    className: 'mdx-safe-callout-warning',
    icon: ADMONITION_ICONS.warning,
  },
  caution: {
    label: CALLOUT_TITLES.caution,
    className: 'mdx-safe-callout-caution',
    icon: ADMONITION_ICONS.caution,
  },
  danger: {
    label: CALLOUT_TITLES.danger,
    className: 'mdx-safe-callout-danger',
    icon: ADMONITION_ICONS.danger,
  },
  important: {
    label: CALLOUT_TITLES.important,
    className: 'mdx-safe-callout-important',
    icon: ADMONITION_ICONS.important,
  },
};

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
