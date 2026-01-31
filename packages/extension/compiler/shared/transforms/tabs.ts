// packages/extension/compiler/shared/transforms/tabs.ts
// transform Tabs/TabItem/Tab components to semantic HTML

import type { RootContent } from 'mdast';
import type { MdxJsxElement } from '../../../types';
import { getStaticStringProp, escapeHtml, createNode } from './utils';

// transform Tabs container component to semantic HTML (non-interactive in Safe Mode)
export function transformTabs(node: MdxJsxElement): RootContent {
  return createNode({
    type: 'tabs',
    hName: 'div',
    className: 'mdx-safe-tabs',
    children: [
      {
        type: 'html',
        value:
          '<div class="mdx-safe-tabs-notice">Tab content (interactive tabs require Trusted Mode)</div>',
      },
      createNode({
        type: 'tabsContent',
        hName: 'div',
        className: 'mdx-safe-tabs-content',
        children: node.children,
      }),
    ],
  }) as RootContent;
}

// transform TabItem/Tab component to semantic HTML
export function transformTabItem(node: MdxJsxElement): RootContent {
  const label =
    getStaticStringProp(node, 'label') ||
    getStaticStringProp(node, 'value') ||
    'Tab';

  return createNode({
    type: 'tabItem',
    hName: 'div',
    className: 'mdx-safe-tab-panel',
    children: [
      createNode({
        type: 'tabItemHeader',
        hName: 'div',
        className: 'mdx-safe-tab-panel-header',
        children: [{ type: 'text', value: escapeHtml(label) }],
      }),
      createNode({
        type: 'tabItemContent',
        hName: 'div',
        className: 'mdx-safe-tab-panel-content',
        children: node.children,
      }),
    ],
  }) as RootContent;
}
