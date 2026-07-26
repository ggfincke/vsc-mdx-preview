// packages/webview-client/src/features/code-block/utils/katexLoader.ts
// lazy-load KaTeX CSS only when math content is detected
// defer 115KB CSS through idempotent resource loader for faster startup

import { createResourceLoader } from '../../../shared/utils/createResourceLoader';
import { createTaggedLogger } from '../../../shared/utils/createTaggedLogger';

const log = createTaggedLogger('KATEX');
const loader = createResourceLoader(
  () => import('katex/dist/katex.min.css').then(() => undefined),
  { name: 'KATEX', allowRetry: true }
);

// load KaTeX CSS (idempotent)
export function loadKatexCss(): Promise<void> {
  return loader.load().catch((error: unknown) => {
    log.warn(
      'KaTeX CSS failed to load; math will render without styling',
      error
    );
  });
}
