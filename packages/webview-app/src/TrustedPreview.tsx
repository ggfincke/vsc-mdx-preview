// packages/webview-app/src/TrustedPreview.tsx
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
import { evaluateModuleToComponent } from './module-system';
import {
  usePreviewSetup,
  useAsyncEffect,
  useKatexDetection,
  useCodeBlockEnhancement,
} from './hooks';
import { PreviewContainer } from './components/PreviewContainer/PreviewContainer';
import type { TrustedPreviewContent, PreviewError } from './types';
import { extractErrorInfo } from '@mdx-preview/shared';
import { shallowArrayEquals, createFieldComparator } from './utils/memoCompare';

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
// wrapped w/ React.memo to prevent re-renders when only zoom changes (content unchanged)
export const TrustedPreviewRenderer = memo(function TrustedPreviewRenderer({
  content,
  evaluatedComponent,
  onComponentReady,
  onError,
}: TrustedPreviewRendererProps) {
  // local loading state tracks webview-side module evaluation (distinct from global
  // isLoading which tracks extension-side compilation). This separation is intentional -
  // the global loading state controls the LoadingBar overlay, while isEvaluating controls
  // evaluation phase spinner
  const [isEvaluating, setIsEvaluating] = useState(false);

  // shared preview setup (container ref, mermaid rendering, image lightbox)
  const { containerRef, handleImageClick, renderPortals, scan } =
    usePreviewSetup({
      mermaidMode: 'before-paint',
      filterStale: true,
    });

  // evaluate code when content changes
  useAsyncEffect(
    async () => {
      return evaluateModuleToComponent(
        content.code,
        content.entryFilePath,
        content.dependencies
      );
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

  // trigger mermaid scan when component becomes available
  // (hook's initial scan runs before container is rendered during loading state)
  useLayoutEffect(() => {
    if (evaluatedComponent && containerRef.current) {
      scan();
    }
  }, [containerRef, evaluatedComponent, scan]);

  // lazy-load KaTeX CSS when math content is detected (DOM-based detection)
  useKatexDetection({ containerRef, trigger: evaluatedComponent });

  // enhance Shiki code blocks w/ copy buttons & language badges
  useCodeBlockEnhancement({ containerRef, trigger: evaluatedComponent });

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
      mermaidPortals={renderPortals()}
    >
      {mdxNode}
    </PreviewContainer>
  );
}, arePropsEqual);

export default TrustedPreviewRenderer;
