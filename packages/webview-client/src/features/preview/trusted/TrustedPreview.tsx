// packages/webview-client/src/features/preview/trusted/TrustedPreview.tsx
// render MDX content in Trusted Mode (evaluates transpiled code & renders React component)

import {
  memo,
  useLayoutEffect,
  useState,
  isValidElement,
  cloneElement,
  createElement,
  type ComponentType,
  type ReactNode,
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

// resolve MDX export to renderable React node
// handle both function components & pre-rendered React elements
// defensive approach fixes React #130 errors when MDX module returns element object
function resolveMdxNode(
  exp: unknown,
  props: Record<string, unknown> = {}
): ReactNode {
  let v = exp;

  // unwrap nested default exports, but don't unwrap React elements
  for (let i = 0; i < 5; i++) {
    if (v && typeof v === 'object' && 'default' in v && !isValidElement(v)) {
      v = (v as { default: unknown }).default;
      continue;
    }
    break;
  }

  // clone React element w/ props
  if (isValidElement(v)) {
    return cloneElement(v, props);
  }

  // function component or string - create element
  if (typeof v === 'function' || typeof v === 'string') {
    return createElement(v, props);
  }

  // invalid export
  const keys = v && typeof v === 'object' ? Object.keys(v).join(', ') : '';
  throw new Error(
    `Invalid MDX export. Expected function or React element, got: ${typeof v}` +
      (keys ? ` (keys: ${keys})` : '')
  );
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
  const { containerRef, handleImageClick, renderPortals, scan } =
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
      return component as ComponentType;
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

  // trigger diagram scan when component becomes available
  // (hook's initial scan runs before container is rendered during loading state)
  useLayoutEffect(() => {
    if (evaluatedComponent && containerRef.current) {
      scan();
    }
  }, [containerRef, evaluatedComponent, scan]);

  usePreviewInteractions({
    containerRef,
    trigger: evaluatedComponent,
    mode: 'trusted',
  });

  // show loading state while evaluating
  if (isEvaluating || !evaluatedComponent) {
    return (
      <div className="mdx-trusted-preview-loading">
        <div className="mdx-loading-spinner" />
        <span>Evaluating...</span>
      </div>
    );
  }

  // render evaluated component using defensive resolver
  // handle both function components & pre-rendered React elements
  const mdxNode = resolveMdxNode(evaluatedComponent);
  return (
    <PreviewContainer
      containerRef={containerRef}
      mode="trusted"
      onImageClick={handleImageClick}
      diagramPortals={renderPortals()}
      className="markdown-body"
    >
      {mdxNode}
    </PreviewContainer>
  );
}, arePropsEqual);

export default TrustedPreviewRenderer;
