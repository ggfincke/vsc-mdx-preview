// packages/webview-client/src/app/state/NextraContext.tsx
// React context for Nextra page metadata - manage page-level settings from _meta.json

import { useState, useCallback, useMemo } from 'react';
import type { NextraPageMeta } from '@mdx-preview/contracts';
import { createTaggedLogger } from '../../shared/utils/createTaggedLogger';
import { LogTags } from '@mdx-preview/contracts';
import { createContextProvider } from '../providers/createContextProvider';

interface NextraContextValue {
  nextraMeta: NextraPageMeta | null;
  setNextraMeta: (meta: NextraPageMeta | null) => void;
}

// module-level tagged logger (avoids per-render allocation)
const log = createTaggedLogger(LogTags.NEXTRA_CONTEXT);

// hook that provide the Nextra context value
function useNextraProviderValue(): NextraContextValue {
  const [nextraMeta, setNextraMetaState] = useState<NextraPageMeta | null>(
    null
  );

  const setNextraMeta = useCallback((meta: NextraPageMeta | null) => {
    log.debug('setNextraMeta called', meta);
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
