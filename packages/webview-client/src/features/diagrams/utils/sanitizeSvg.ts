// packages/webview-client/src/features/diagrams/utils/sanitizeSvg.ts
// sanitize rendered SVG before inserting into DOM

import DOMPurify from 'dompurify';
import { DOMPURIFY_CONFIG } from '../../preview/safe/security/allowlist';

export function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, DOMPURIFY_CONFIG) as string;
}
