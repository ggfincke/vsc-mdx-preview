// packages/webview-client/src/features/preview/shared/hooks/useTocExtraction.ts
// extract headings from rendered DOM for TOC sidebar

import { useCallback, useRef, type RefObject } from 'react';
import { useToc, type TocHeading } from '../../../../app/state/TocContext';

// query all headings w/ IDs from the preview container & update TOC context
export function useTocExtraction(
  containerRef: RefObject<HTMLDivElement>
): () => void {
  const { setHeadings } = useToc();
  // track last serialized headings to skip no-op updates (prevents infinite loops)
  const lastKeyRef = useRef<string>('');

  const extractHeadings = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    // query headings w/ IDs (rehype-slug generates IDs for both Safe & Trusted modes)
    const nodes = container.querySelectorAll<HTMLHeadingElement>(
      'h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]'
    );

    if (nodes.length === 0) {
      if (lastKeyRef.current !== '') {
        lastKeyRef.current = '';
        setHeadings(null);
      }
      return;
    }

    const headings: TocHeading[] = Array.from(nodes)
      .map((el) => {
        // strip trailing anchor link `#` text from heading text content
        const anchor = el.querySelector(
          'a.anchor-link, a.anchor, a[aria-hidden]'
        );
        let text = el.textContent ?? '';
        if (anchor?.textContent) {
          text = text.replace(anchor.textContent, '').trim();
        }

        const level = parseInt(el.tagName[1], 10) as TocHeading['level'];

        return {
          id: el.id,
          text: text.trim(),
          level,
        };
      })
      .filter((heading) => heading.id && heading.text.length > 0);

    // skip update if headings haven't changed (stable key = id+level+text joined)
    const key = headings.map((h) => `${h.id}:${h.level}:${h.text}`).join('|');
    if (key === lastKeyRef.current) {
      return;
    }
    lastKeyRef.current = key;
    setHeadings(headings);
  }, [containerRef, setHeadings]);

  return extractHeadings;
}
