// packages/extension/compiler/plugins/shared-plugins.ts
// * shared remark/rehype plugin configurations for MDX pipelines
//
// ! plugin ordering is critical - do not reorder w/o testing both Safe & Trusted modes
// ! remarkDirective must run first (parses ::: syntax)
// ! remarkAdmonitions must run after remarkDirective (transforms directives)
// ! remarkGithubAlerts must run before remarkGfm

import remarkDirective from 'remark-directive';
import remarkAdmonitions from '../shared/remark/admonitions';
import remarkGithubAlerts from '../shared/remark/github-alerts';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeMermaidPlaceholder from '../shared/rehype/mermaid-placeholder';
import rehypeKatex from 'rehype-katex';
import rehypeShiki from '../shared/rehype/shiki';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeLazyImages from '../shared/rehype/lazy-images';
import type { Pluggable } from 'unified';

// shared autolink headings config for both pipelines
export const autolinkHeadingsConfig = {
  behavior: 'append' as const,
  properties: {
    className: ['anchor-link'],
    ariaLabel: 'Link to this section',
  },
};

// shared remark plugins (order matters!)
// 1. remarkDirective parses ::: syntax into directive nodes
// 2. remarkAdmonitions transforms directive nodes to admonition HTML
// 3. remarkGithubAlerts handles [!NOTE] etc. (must come before GFM)
// 4. remarkGfm adds GitHub Flavored Markdown
// 5. remarkMath handles math expressions
export const sharedRemarkPlugins: Pluggable[] = [
  remarkDirective,
  remarkAdmonitions,
  remarkGithubAlerts,
  remarkGfm,
  remarkMath,
];

// shared rehype plugins before math rendering (same order in both pipelines)
export const sharedRehypePluginsPreMath: Pluggable[] = [
  rehypeMermaidPlaceholder,
];

// rehype-katex plugin (shared between both pipelines)
export { rehypeKatex };

// shared rehype plugins after math rendering (& after rehypeRaw in Trusted mode)
export const sharedRehypePluginsPostMath: Pluggable[] = [
  rehypeShiki,
  rehypeSlug,
  [rehypeAutolinkHeadings, autolinkHeadingsConfig],
  rehypeLazyImages,
];
