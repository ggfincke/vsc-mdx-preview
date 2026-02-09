// AUTO-GENERATED FILE - DO NOT EDIT
// Source: packages/registry/src/shims/shim-config.ts
// packages/webview-client/src/generated/framework-css/frameworkCssLoader.ts
// load framework CSS only when that framework shims are used

import type { FrameworkId } from '@mdx-preview/contracts';
import {
  createResourceLoader,
  type ResourceLoader,
} from '../../shared/utils/createResourceLoader';

// create a loader for each framework
const loaders: Record<FrameworkId, ResourceLoader> = {
  generic: createResourceLoader(
    () =>
      import('../../features/shims/generic/styles.css').then(() => undefined),
    { name: 'generic-css', allowRetry: true }
  ),
  docusaurus: createResourceLoader(
    () =>
      import('../../features/shims/docusaurus/styles.css').then(
        () => undefined
      ),
    { name: 'docusaurus-css', allowRetry: true }
  ),
  starlight: createResourceLoader(
    () =>
      import('../../features/shims/starlight/styles.css').then(() => undefined),
    { name: 'starlight-css', allowRetry: true }
  ),
  nextra: createResourceLoader(
    () =>
      import('../../features/shims/nextra/styles.css').then(() => undefined),
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
