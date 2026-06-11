// packages/webview-client/src/features/preview/shared/ui/PreviewContainer/PreviewContainer.tsx
// shared container component for SafePreview & TrustedPreview

import type { ReactNode, RefObject, MouseEvent } from 'react';
import { cn } from '../../../../../shared/utils/cn';
import {
  SAFE_PREVIEW_CLASS,
  TRUSTED_PREVIEW_CLASS,
} from '../../../safe/security/previewClassNames';
import './PreviewContainer.css';

export interface PreviewContainerProps {
  // container ref
  containerRef: RefObject<HTMLDivElement>;
  // mode attribute
  mode: 'safe' | 'trusted';
  // image click handler
  onImageClick?: (event: MouseEvent<HTMLDivElement>) => void;
  // diagram portals
  diagramPortals: ReactNode;
  // children
  children?: ReactNode;
  // className
  className?: string;
}

// shared container component for both Safe & Trusted preview modes
// provide ref attachment, mode styling hooks, lightbox & diagram portals
export function PreviewContainer({
  containerRef,
  mode,
  onImageClick,
  diagramPortals,
  children,
  className,
}: PreviewContainerProps) {
  const baseClass =
    mode === 'safe' ? SAFE_PREVIEW_CLASS : TRUSTED_PREVIEW_CLASS;

  return (
    <div
      ref={containerRef}
      className={cn(baseClass, className)}
      data-mode={mode}
      onClick={onImageClick}
    >
      {children}
      {diagramPortals}
    </div>
  );
}
