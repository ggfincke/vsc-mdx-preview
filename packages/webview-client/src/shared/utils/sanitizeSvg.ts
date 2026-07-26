// packages/webview-client/src/shared/utils/sanitizeSvg.ts
// sanitize rendered SVG before inserting into DOM

import DOMPurify from 'dompurify';
import { RENDERED_CONTENT_PURIFY_CONFIG } from './rendered-content-sanitization';

export function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, RENDERED_CONTENT_PURIFY_CONFIG) as string;
}
