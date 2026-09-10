// packages/webview-client/src/features/preview/trusted/TrustedPreview.tsx
// render MDX content in Trusted Mode (evaluates transpiled code & renders React component)

import {
  memo,
  useMemo,
  useState,
  createElement,
  type ComponentType,
} from 'react';
import { evaluateModuleToComponent } from '../../module-runtime';
import { usePreviewSetup } from '../shared/hooks/usePreviewSetup';
import { usePreviewInteractions } from '../shared/hooks/usePreviewInteractions';
import { useAsyncEffect } from '../../../shared/hooks/useAsyncEffect';
import { PreviewContainer } from '../shared/ui/PreviewContainer/PreviewContainer';
import type { TrustedPreviewContent, PreviewError } from '../../../app/types';
import { extractErrorInfo } from '@mdx-preview/runtime-utils';
import {
  shallowArrayEquals,
  createFieldComparator,
} from '../../../shared/utils/memoCompare';

function isMdxComponent(value: unknown): value is ComponentType {
  return typeof value === 'function';
}

interface TrustedPreviewRendererProps {
  content: TrustedPreviewContent;
  evaluatedComponent: ComponentType | null;
  onComponentReady: (component: ComponentType | null) => void;
  onError: (error: PreviewError) => void;
}

// custom comparison for React.memo - checks all content fields including dependencies array
// callbacks (onComponentReady, onError) are stable via useCallback in App.tsx
const arePropsEqual = createFieldComparator<TrustedPreviewRendererProps>({
  content: (prev, next) =>
    prev.code === next.code &&
    prev.entryFilePath === next.entryFilePath &&
    shallowArrayEquals(prev.dependencies, next.dependencies),
  onComponentReady: 'skip',
  onError: 'skip',
});

// evaluate transpiled MDX code & render resulting component (evaluation via module loader using new Function())
// wrapped w/ React.memo to prevent unnecessary re-renders
export const TrustedPreviewRenderer = memo(function TrustedPreviewRenderer({
  content,
  evaluatedComponent,
  onComponentReady,
  onError,
}: TrustedPreviewRendererProps) {
  // track webview-side module evaluation separately from global compilation
  // global loading controls LoadingBar; local loading controls the spinner
  const [isEvaluating, setIsEvaluating] = useState(false);

  // shared preview setup (container ref, diagram rendering, image lightbox)
  const { containerRef, attachContainer, handleImageClick, renderPortals } =
    usePreviewSetup({
      diagramMode: 'before-paint',
      filterStale: true,
    });

  // evaluate code when content changes
  useAsyncEffect(
    async () => {
      const component = await evaluateModuleToComponent(
        content.code,
        content.entryFilePath,
        content.dependencies
      );
      if (!isMdxComponent(component)) {
        throw new Error('MDX module did not evaluate to a React component');
      }
      return component;
    },
    [content.code, content.entryFilePath, content.dependencies],
    {
      onSuccess: onComponentReady,
      onError: (error) => {
        const { message, stack } = extractErrorInfo(error);
        onError({ message, stack });
      },
      onLoadingChange: setIsEvaluating,
    }
  );

  usePreviewInteractions({
    mode: 'trusted',
    containerRef,
    component: evaluatedComponent,
  });

  // memoize resolved element so unrelated re-renders keep element identity
  // & React bails out of the unchanged MDX subtree
  const mdxNode = useMemo(
    () => (evaluatedComponent ? createElement(evaluatedComponent) : null),
    [evaluatedComponent]
  );

  // show loading state while evaluating
  if (isEvaluating || !evaluatedComponent) {
    return (
      <div className="mdx-trusted-preview-loading">
        <div className="mdx-loading-spinner" />
        <span>Evaluating...</span>
      </div>
    );
  }

  return (
    <PreviewContainer
      containerRef={attachContainer}
      mode="trusted"
      onImageClick={handleImageClick}
      diagramPortals={renderPortals()}
      className="markdown-body"
    >
      {mdxNode}
    </PreviewContainer>
  );
}, arePropsEqual);
