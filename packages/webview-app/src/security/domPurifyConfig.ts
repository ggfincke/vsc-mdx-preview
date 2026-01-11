// packages/webview-app/src/security/domPurifyConfig.ts
// DOMPurify configuration for Safe Mode HTML sanitization

import type { Config } from 'dompurify';

// DOMPurify configuration for safe rendering (only safe HTML elements & attributes)
export const DOMPURIFY_CONFIG: Config = {
  ALLOWED_TAGS: [
    // Headings
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    // Text content
    'p',
    'span',
    'div',
    'br',
    'hr',
    // Lists
    'ul',
    'ol',
    'li',
    // Text formatting
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'strike',
    'del',
    'ins',
    'mark',
    'sub',
    'sup',
    'small',
    // Code
    'pre',
    'code',
    'kbd',
    'samp',
    'var',
    // links & media
    'a',
    'img',
    // quotes & citations
    'blockquote',
    'q',
    'cite',
    'abbr',
    // Tables
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
    'caption',
    'colgroup',
    'col',
    // Definition lists
    'dl',
    'dt',
    'dd',
    // Other
    'details',
    'summary',
    'figure',
    'figcaption',
    // KaTeX math elements
    'math',
    'semantics',
    'mrow',
    'mi',
    'mo',
    'mn',
    'msup',
    'msub',
    'msubsup',
    'mfrac',
    'mover',
    'munder',
    'munderover',
    'mtable',
    'mtr',
    'mtd',
    'msqrt',
    'mroot',
    'mtext',
    'mspace',
    'annotation',
    'menclose',
    'mphantom',
    'mpadded',
    'mglyph',
    'mlabeledtr',
    'mmultiscripts',
    'mprescripts',
    'none',
    // SVG elements for Mermaid diagrams (no foreignObject for security)
    'svg',
    'g',
    'path',
    'rect',
    'circle',
    'ellipse',
    'line',
    'polyline',
    'polygon',
    'text',
    'tspan',
    'textPath',
    'defs',
    'clipPath',
    'mask',
    'marker',
    'use',
    'symbol',
    'linearGradient',
    'radialGradient',
    'stop',
    'pattern',
    'switch',
    'desc',
    'title',
    'metadata',
  ],
  ALLOWED_ATTR: [
    'href',
    'src',
    'alt',
    'title',
    'class',
    'id',
    'name',
    'target',
    'rel',
    'width',
    'height',
    'colspan',
    'rowspan',
    'scope',
    'loading',
    'decoding',
    // KaTeX math attributes
    'mathvariant',
    'encoding',
    'stretchy',
    'fence',
    'lspace',
    'rspace',
    'columnalign',
    'rowalign',
    'columnspacing',
    'rowspacing',
    'displaystyle',
    'scriptlevel',
    'xmlns',
    'accent',
    'accentunder',
    'notation',
    'separator',
    'movablelimits',
    'symmetric',
    'maxsize',
    'minsize',
    'largeop',
    'form',
    'linethickness',
    'numalign',
    'denomalign',
    'bevelled',
    // KaTeX uses inline styles for sizing/positioning
    'style',
    // SVG attributes for Mermaid diagrams
    'd',
    'fill',
    'stroke',
    'stroke-width',
    'stroke-linecap',
    'stroke-linejoin',
    'stroke-dasharray',
    'stroke-dashoffset',
    'stroke-opacity',
    'fill-opacity',
    'fill-rule',
    'transform',
    'viewBox',
    'x',
    'y',
    'x1',
    'y1',
    'x2',
    'y2',
    'cx',
    'cy',
    'r',
    'rx',
    'ry',
    'points',
    'dx',
    'dy',
    'text-anchor',
    'dominant-baseline',
    'font-size',
    'font-family',
    'font-weight',
    'opacity',
    'clip-path',
    'marker-end',
    'marker-start',
    'marker-mid',
    'gradientUnits',
    'spreadMethod',
    'offset',
    'stop-color',
    'stop-opacity',
    'patternUnits',
    'patternContentUnits',
    'preserveAspectRatio',
    'xlink:href',
    // Mermaid data attributes
    'data-mermaid-chart',
    'data-mermaid-id',
    // Admonition data attributes
    'data-admonition-type',
  ],
  ADD_ATTR: ['target', 'rel'],
  ALLOW_UNKNOWN_PROTOCOLS: false,
  ALLOWED_URI_REGEXP:
    /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
};

// process links to ensure they're safe (external links open in new tab w/ noopener noreferrer)
export function processLinks(container: HTMLElement): void {
  const links = container.querySelectorAll('a');
  links.forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) {
      return;
    }

    // internal anchor links
    if (href.startsWith('#')) {
      return;
    }

    // external links (open in new tab securely)
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  });
}

// add clickable cursor to images for lightbox
export function processImages(container: HTMLElement): void {
  const images = container.querySelectorAll('img');
  images.forEach((img) => {
    img.style.cursor = 'zoom-in';
  });
}

// ensure safe mode placeholder styles are present
export function ensureSafeModeStyles(): void {
  const styleId = 'mdx-safe-mode-styles';
  if (document.getElementById(styleId)) {
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .mdx-jsx-placeholder,
    .mdx-expression-placeholder {
      display: inline-block;
      padding: 2px 6px;
      margin: 2px;
      background-color: var(--vscode-textBlockQuote-background, rgba(127, 127, 127, 0.1));
      border: 1px dashed var(--vscode-textBlockQuote-border, rgba(127, 127, 127, 0.3));
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 0.9em;
      color: var(--vscode-descriptionForeground, #717171);
      cursor: help;
    }

    .mdx-safe-preview {
      padding: 16px;
    }
  `;
  document.head.appendChild(style);
}
