// packages/webview-app/src/context/NextraContext.tsx
// React context for Nextra page metadata - manage page-level settings from _meta.json

import { useState, useCallback, useMemo } from 'react';
import type { NextraPageMeta } from '@mdx-preview/shared';
import { debug } from '../utils/debug';
import { LogTags } from '@mdx-preview/shared';
import { createContextProvider } from './createContextProvider';

interface NextraContextValue {
  nextraMeta: NextraPageMeta | null;
  setNextraMeta: (meta: NextraPageMeta | null) => void;
}

// hook that provides the Nextra context value
function useNextraProviderValue(): NextraContextValue {
  const [nextraMeta, setNextraMetaState] = useState<NextraPageMeta | null>(null);

  const setNextraMeta = useCallback((meta: NextraPageMeta | null) => {
    debug(`[${LogTags.NEXTRA_CONTEXT}] setNextraMeta called`, meta);
    setNextraMetaState(meta);
  }, []);

  return useMemo(
    () => ({ nextraMeta, setNextraMeta }),
    [nextraMeta, setNextraMeta]
  );
}

const { Provider, useContextValue } = createContextProvider<NextraContextValue>(
  'Nextra',
  useNextraProviderValue
);

export const NextraProvider = Provider;
export const useNextra = useContextValue;
