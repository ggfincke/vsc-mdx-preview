// packages/extension/transpiler/mdx/shared-plugins.ts
// * shared remark/rehype plugin configurations for MDX pipelines
//
// ! plugin ordering is critical - do not reorder w/o testing both Safe & Trusted modes
// ! remarkGithubAlerts must run before remarkGfm
// ! rehypeSourcepos must run before structural changes (slug, autolink)

import remarkGithubAlerts from './remark-github-alerts';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeSourcepos from './rehype-sourcepos';
import rehypeMermaidPlaceholder from './rehype-mermaid-placeholder';
import rehypeKatex from 'rehype-katex';
import rehypeShiki from './rehype-shiki';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeLazyImages from './rehype-lazy-images';
import type { Pluggable } from 'unified';

// shared autolink headings config for both pipelines
export const autolinkHeadingsConfig = {
  behavior: 'append' as const,
  properties: {
    className: ['anchor-link'],
    ariaLabel: 'Link to this section',
  },
};

// shared remark plugins (order matters: GitHub alerts must come before GFM)
export const sharedRemarkPlugins: Pluggable[] = [
  remarkGithubAlerts,
  remarkGfm,
  remarkMath,
];

// shared rehype plugins before math rendering (same order in both pipelines)
export const sharedRehypePluginsPreMath: Pluggable[] = [
  rehypeSourcepos,
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
