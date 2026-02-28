// packages/webview-client/src/app/state/FrontmatterContext.tsx
// React context for frontmatter data - show key-value pairs in collapsible panel

import { useState, useCallback, useMemo } from 'react';
import { createTaggedLogger } from '../../shared/utils/createTaggedLogger';
import { LogTags } from '@mdx-preview/contracts';
import { createContextProvider } from '../providers/createContextProvider';

interface FrontmatterContextValue {
  frontmatter: Record<string, unknown> | null;
  setFrontmatter: (data: Record<string, unknown> | null) => void;
}

// module-level tagged logger (avoids per-render allocation)
const log = createTaggedLogger(LogTags.APP);

// hook that provides the frontmatter context value
function useFrontmatterProviderValue(): FrontmatterContextValue {
  const [frontmatter, setFrontmatterState] = useState<Record<
    string,
    unknown
  > | null>(null);

  const setFrontmatter = useCallback((data: Record<string, unknown> | null) => {
    log.debug('setFrontmatter called', data ? Object.keys(data) : null);
    setFrontmatterState(data);
  }, []);

  return useMemo(
    () => ({ frontmatter, setFrontmatter }),
    [frontmatter, setFrontmatter]
  );
}

const { Provider, useContextValue } =
  createContextProvider<FrontmatterContextValue>(
    'Frontmatter',
    useFrontmatterProviderValue
  );

export const FrontmatterProvider = Provider;
export const useFrontmatter = useContextValue;
