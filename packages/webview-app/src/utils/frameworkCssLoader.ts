// packages/webview-app/src/utils/frameworkCssLoader.ts
// Lazy-load framework CSS only when that framework's shims are used
// Follows the same pattern as katexLoader.ts for consistency

import type { FrameworkId } from '@mdx-preview/shared';

// Track which framework CSS has been loaded (idempotent loading)
const loadedCss = new Set<FrameworkId>();

// load CSS for a specific framework (idempotent)
export async function loadFrameworkCss(framework: FrameworkId): Promise<void> {
  // Skip if already loaded
  if (loadedCss.has(framework)) {
    return;
  }

  // Mark as loaded immediately to prevent duplicate loads
  loadedCss.add(framework);

  // Dynamic import for framework-specific CSS
  switch (framework) {
    case 'generic':
      await import('../components/shims/generic/styles.css');
      break;
    case 'docusaurus':
      await import('../components/shims/docusaurus/styles.css');
      break;
    case 'starlight':
      await import('../components/shims/starlight/styles.css');
      break;
    case 'nextra':
      await import('../components/shims/nextra/styles.css');
      break;
    case 'nextjs':
      // Next.js shims don't have custom styles currently
      break;
    default:
      // Unknown framework, no CSS to load
      break;
  }
}

// check if CSS for a framework has been loaded
export function isFrameworkCssLoaded(framework: FrameworkId): boolean {
  return loadedCss.has(framework);
}

// reset CSS loader state (for testing)
export function resetFrameworkCssLoader(): void {
  loadedCss.clear();
}
