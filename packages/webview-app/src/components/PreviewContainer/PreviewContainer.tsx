// packages/webview-app/src/components/PreviewContainer/PreviewContainer.tsx
// shared container component for SafePreview & TrustedPreview

import type { ReactNode, RefObject, MouseEvent } from 'react';
import './PreviewContainer.css';

export interface PreviewContainerProps {
  // ref to the container div for DOM manipulation (mermaid rendering, etc.)
  containerRef: RefObject<HTMLDivElement>;
  // mode attribute for styling hooks ('safe' or 'trusted')
  mode: 'safe' | 'trusted';
  // React onClick handler for image lightbox (TrustedPreview)
  // SafePreview uses imperative addEventListener instead
  onImageClick?: (event: MouseEvent<HTMLDivElement>) => void;
  // mermaid portals rendered via useMermaidRendering hook
  mermaidPortals: ReactNode;
  // content to render inside the container
  // SafePreview: empty (HTML injected via innerHTML)
  // TrustedPreview: MDXComponent
  children?: ReactNode;
  // additional CSS classes to apply
  className?: string;
}

// shared container component for both Safe & Trusted preview modes
// provides a unified structure for:
// - container ref attachment for DOM manipulation
// - mode attribute for styling hooks
// - optional onClick handler for image lightbox
// - mermaid portal rendering
// - markdown-body class for styling
export function PreviewContainer({
  containerRef,
  mode,
  onImageClick,
  mermaidPortals,
  children,
  className,
}: PreviewContainerProps) {
  const baseClass = mode === 'safe' ? 'mdx-safe-preview' : 'mdx-trusted-preview';
  const combinedClassName = className
    ? `${baseClass} ${className}`
    : baseClass;

  return (
    <div
      ref={containerRef}
      className={combinedClassName}
      data-mode={mode}
      onClick={onImageClick}
    >
      {children}
      {mermaidPortals}
    </div>
  );
}

export default PreviewContainer;
