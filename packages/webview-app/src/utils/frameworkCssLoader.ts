// AUTO-GENERATED FILE - DO NOT EDIT
// Source: packages/shared/shims/shim-config.ts
// packages/webview-app/src/utils/frameworkCssLoader.ts
// load framework CSS only when that framework shims are used

import type { FrameworkId } from '@mdx-preview/shared';
import {
  createResourceLoader,
  type ResourceLoader,
} from './createResourceLoader';

// create a loader for each framework
const loaders: Record<FrameworkId, ResourceLoader> = {
  generic: createResourceLoader(
    () =>
      import('../components/shims/generic/styles.css').then(() => undefined),
    { name: 'generic-css', allowRetry: true }
  ),
  docusaurus: createResourceLoader(
    () =>
      import('../components/shims/docusaurus/styles.css').then(() => undefined),
    { name: 'docusaurus-css', allowRetry: true }
  ),
  starlight: createResourceLoader(
    () =>
      import('../components/shims/starlight/styles.css').then(() => undefined),
    { name: 'starlight-css', allowRetry: true }
  ),
  nextra: createResourceLoader(
    () => import('../components/shims/nextra/styles.css').then(() => undefined),
    { name: 'nextra-css', allowRetry: true }
  ),
  nextjs: createResourceLoader(() => Promise.resolve(), {
    name: 'nextjs-css',
    allowRetry: false,
  }),
};

// load CSS for a specific framework
export async function loadFrameworkCss(framework: FrameworkId): Promise<void> {
  const loader = loaders[framework];
  if (loader) {
    return loader.load();
  }
}

// check if CSS for a framework has been loaded
export function isFrameworkCssLoaded(framework: FrameworkId): boolean {
  const loader = loaders[framework];
  return loader ? loader.isLoaded() : false;
}

// reset CSS loader state
export function resetFrameworkCssLoader(): void {
  for (const loader of Object.values(loaders)) {
    loader.reset();
  }
}
