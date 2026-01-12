// packages/webview-app/src/components/shims/nextjs/Link.tsx
// Shim for next/link - provides basic anchor rendering without Next.js routing

import { AnchorHTMLAttributes, ReactNode } from 'react';

// Next.js Link component props subset (relevant props for preview)
export interface LinkProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
> {
  href:
    | string
    | { pathname?: string; query?: Record<string, string>; hash?: string };
  children: ReactNode;
  as?: string;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  passHref?: boolean;
  prefetch?: boolean;
  locale?: string | false;
  legacyBehavior?: boolean;
}

// resolve href object to string
function resolveHref(href: LinkProps['href']): string {
  if (typeof href === 'string') {
    return href;
  }

  let url = href.pathname ?? '';

  // add query string
  if (href.query && Object.keys(href.query).length > 0) {
    const params = new URLSearchParams(href.query);
    url += `?${params.toString()}`;
  }

  // add hash
  if (href.hash) {
    url += href.hash.startsWith('#') ? href.hash : `#${href.hash}`;
  }

  return url;
}

// simple link component that renders as an anchor
export function Link({
  href,
  children,
  as: _as,
  replace: _replace,
  scroll: _scroll,
  shallow: _shallow,
  passHref: _passHref,
  prefetch: _prefetch,
  locale: _locale,
  legacyBehavior: _legacyBehavior,
  className,
  ...rest
}: LinkProps) {
  const resolvedHref = resolveHref(href);

  // check if external link
  const isExternal =
    resolvedHref.startsWith('http://') ||
    resolvedHref.startsWith('https://') ||
    resolvedHref.startsWith('//');

  return (
    <a
      href={resolvedHref}
      className={className}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      {...rest}
    >
      {children}
    </a>
  );
}

export default Link;
