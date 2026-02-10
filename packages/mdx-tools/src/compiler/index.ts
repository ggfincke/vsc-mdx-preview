export { compileSafe } from './safe/compile';
export { compileTrusted } from './trusted/compile';

// frontmatter extraction utilities
export {
  extractFrontmatter,
  extractNextraFrontmatter,
} from './pipeline/common/mdx-common';

// known generic component set for diagnostics
export { KNOWN_GENERIC_COMPONENTS } from './pipeline/remark/generic-components';

// plugin loading & merging
export { loadPluginsFromConfig, mergePlugins } from './plugins/loader';

export * from './types';
