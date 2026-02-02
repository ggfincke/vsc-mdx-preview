// packages/webview-app/src/components/PreviewContainer/PreviewContainer.tsx
// shared container component for SafePreview & TrustedPreview

import type { ReactNode, RefObject, MouseEvent } from 'react';
import { cn } from '../../utils/cn';
import './PreviewContainer.css';

export interface PreviewContainerProps {
  // container ref
  containerRef: RefObject<HTMLDivElement>;
  // mode attribute
  mode: 'safe' | 'trusted';
  // image click handler
  onImageClick?: (event: MouseEvent<HTMLDivElement>) => void;
  // mermaid portals
  mermaidPortals: ReactNode;
  // children
  children?: ReactNode;
  // className
  className?: string;
}

// shared container component for both Safe & Trusted preview modes
// provides a unified structure for
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

  return (
    <div
      ref={containerRef}
      className={cn(baseClass, className)}
      data-mode={mode}
      onClick={onImageClick}
    >
      {children}
      {mermaidPortals}
    </div>
  );
}

export default PreviewContainer;
