// packages/webview-app/src/utils/frameworkCssLoader.ts
// Lazy-load framework CSS only when that framework's shims are used
//
// Uses createResourceLoader for each framework to ensure idempotent loading
// w/ proper concurrent call deduplication

import type { FrameworkId } from '@mdx-preview/shared';
import { createResourceLoader, type ResourceLoader } from './createResourceLoader';

// Create a loader for each framework
const loaders: Record<FrameworkId, ResourceLoader> = {
  generic: createResourceLoader(
    () => import('../components/shims/generic/styles.css').then(() => undefined),
    { name: 'generic-css', allowRetry: true }
  ),
  docusaurus: createResourceLoader(
    () => import('../components/shims/docusaurus/styles.css').then(() => undefined),
    { name: 'docusaurus-css', allowRetry: true }
  ),
  starlight: createResourceLoader(
    () => import('../components/shims/starlight/styles.css').then(() => undefined),
    { name: 'starlight-css', allowRetry: true }
  ),
  nextra: createResourceLoader(
    () => import('../components/shims/nextra/styles.css').then(() => undefined),
    { name: 'nextra-css', allowRetry: true }
  ),
  nextjs: createResourceLoader(
    // Next.js shims don't have custom styles currently
    () => Promise.resolve(),
    { name: 'nextjs-css', allowRetry: false }
  ),
};

// load CSS for a specific framework (idempotent)
export async function loadFrameworkCss(framework: FrameworkId): Promise<void> {
  const loader = loaders[framework];
  if (loader) {
    return loader.load();
  }
  // Unknown framework, no CSS to load
}

// check if CSS for a framework has been loaded
export function isFrameworkCssLoaded(framework: FrameworkId): boolean {
  const loader = loaders[framework];
  return loader ? loader.isLoaded() : false;
}

// reset CSS loader state (for testing)
export function resetFrameworkCssLoader(): void {
  for (const loader of Object.values(loaders)) {
    loader.reset();
  }
}
