// packages/webview-client/src/features/preview/shared/ui/TableOfContents/TableOfContents.tsx
// floating TOC sidebar extracted from rendered DOM headings

import {
  memo,
  useState,
  useCallback,
  useEffect,
  useRef,
  type MouseEvent,
} from 'react';
import { useToc } from '../../../../../app/state/TocContext';
import './TableOfContents.css';

// render the TOC sidebar only when showToc is enabled & headings are available
export const TableOfContents = memo(function TableOfContents() {
  const { headings, showToc, activeHeadingId, setActiveHeadingId } = useToc();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const listRef = useRef<HTMLUListElement | null>(null);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const handleHeadingClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, headingId: string) => {
      event.preventDefault();
      const headingElement = document.getElementById(headingId);
      if (!headingElement) {
        return;
      }

      setActiveHeadingId(headingId);
      headingElement.scrollIntoView({ behavior: 'smooth', block: 'start' });

      const hash = `#${headingId}`;
      if (window.location.hash !== hash) {
        window.history.replaceState(null, '', hash);
      }
    },
    [setActiveHeadingId]
  );

  useEffect(() => {
    if (!showToc || !headings || headings.length === 0) {
      setActiveHeadingId(null);
      return;
    }

    const headingElements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((node): node is HTMLElement => !!node);

    if (headingElements.length === 0) {
      setActiveHeadingId(null);
      return;
    }

    const findActiveHeading = (): string | null => {
      let activeId = headingElements[0]?.id ?? null;

      for (const headingElement of headingElements) {
        if (headingElement.getBoundingClientRect().top <= 120) {
          activeId = headingElement.id;
          continue;
        }
        break;
      }

      return activeId;
    };

    setActiveHeadingId(findActiveHeading());

    const handleResize = () => {
      setActiveHeadingId(findActiveHeading());
    };

    if (typeof IntersectionObserver === 'undefined') {
      const handleScroll = () => {
        setActiveHeadingId(findActiveHeading());
      };

      window.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleResize);
      };
    }

    const visibleHeadings = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const element = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            visibleHeadings.set(element.id, entry.boundingClientRect.top);
            return;
          }

          visibleHeadings.delete(element.id);
        });

        if (visibleHeadings.size === 0) {
          setActiveHeadingId(findActiveHeading());
          return;
        }

        const ordered = Array.from(visibleHeadings.entries()).sort(
          (a, b) => Math.abs(a[1] - 120) - Math.abs(b[1] - 120)
        );
        setActiveHeadingId(ordered[0]?.[0] ?? null);
      },
      {
        root: null,
        rootMargin: '-18% 0px -62% 0px',
        threshold: [0, 0.25, 0.75, 1],
      }
    );

    headingElements.forEach((headingElement) => {
      observer.observe(headingElement);
    });

    window.addEventListener('resize', handleResize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [headings, setActiveHeadingId, showToc]);

  useEffect(() => {
    if (!activeHeadingId || !listRef.current || isCollapsed) {
      return;
    }

    const activeLink = Array.from(
      listRef.current.querySelectorAll<HTMLAnchorElement>('.mdx-toc-link')
    ).find((link) => link.dataset.headingId === activeHeadingId);

    activeLink?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    });
  }, [activeHeadingId, isCollapsed]);

  // gate render on showToc flag & non-empty headings
  if (!showToc || !headings || headings.length === 0) {
    return null;
  }

  return (
    <nav
      className={`mdx-toc-panel${isCollapsed ? ' mdx-toc-panel--collapsed' : ''}`}
      aria-label="Table of contents"
    >
      <button
        className="mdx-toc-toggle"
        onClick={toggleCollapsed}
        aria-expanded={!isCollapsed}
        aria-label={
          isCollapsed
            ? 'Expand table of contents'
            : 'Collapse table of contents'
        }
        title={
          isCollapsed
            ? 'Expand table of contents'
            : 'Collapse table of contents'
        }
      >
        <span className="mdx-toc-toggle-icon">{isCollapsed ? '▸' : '▾'}</span>
        {!isCollapsed && (
          <span className="mdx-toc-toggle-label">On this page</span>
        )}
      </button>
      {!isCollapsed && (
        <ul className="mdx-toc-list" role="list" ref={listRef}>
          {headings.map((heading) => (
            <li
              key={heading.id}
              className={`mdx-toc-item mdx-toc-h${heading.level}`}
            >
              <a
                href={`#${heading.id}`}
                className={`mdx-toc-link${activeHeadingId === heading.id ? ' mdx-toc-link--active' : ''}`}
                title={heading.text}
                data-heading-id={heading.id}
                aria-current={
                  activeHeadingId === heading.id ? 'location' : undefined
                }
                onClick={(event) => handleHeadingClick(event, heading.id)}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
});

export default TableOfContents;
