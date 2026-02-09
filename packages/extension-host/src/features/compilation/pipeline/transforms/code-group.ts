// packages/extension/compiler/shared/transforms/code-group.ts
// transform CodeGroup component to semantic HTML

import type { RootContent } from 'mdast';
import type { MdxJsxElement } from '../../../types';
import { createNode } from './utils';

// transform CodeGroup container component to semantic HTML (non-interactive in Safe Mode)
export function transformCodeGroup(node: MdxJsxElement): RootContent {
  return createNode({
    type: 'codeGroup',
    hName: 'div',
    className: 'mdx-safe-code-group',
    children: [
      {
        type: 'html',
        value:
          '<div class="mdx-safe-code-group-notice">Code group (tabbed view requires Trusted Mode)</div>',
      },
      createNode({
        type: 'codeGroupContent',
        hName: 'div',
        className: 'mdx-safe-code-group-content',
        children: node.children,
      }),
    ],
  }) as RootContent;
}
