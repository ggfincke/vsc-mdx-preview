// packages/webview-app/src/context/NextraContext.tsx
// React context for Nextra page metadata - manages page-level settings from _meta.json

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type { NextraPageMeta } from '@mdx-preview/shared';
import { debug } from '../utils/debug';

interface NextraContextValue {
  nextraMeta: NextraPageMeta | null;
  setNextraMeta: (meta: NextraPageMeta | null) => void;
}

const NextraContext = createContext<NextraContextValue | null>(null);

interface NextraProviderProps {
  children: ReactNode;
}

export function NextraProvider({ children }: NextraProviderProps) {
  const [nextraMeta, setNextraMetaState] = useState<NextraPageMeta | null>(null);

  const setNextraMeta = useCallback((meta: NextraPageMeta | null) => {
    debug('[NEXTRA-CONTEXT] setNextraMeta called', meta);
    setNextraMetaState(meta);
  }, []);

  const value = useMemo(
    () => ({ nextraMeta, setNextraMeta }),
    [nextraMeta, setNextraMeta]
  );

  return (
    <NextraContext.Provider value={value}>{children}</NextraContext.Provider>
  );
}

export function useNextra(): NextraContextValue {
  const context = useContext(NextraContext);
  if (!context) {
    throw new Error('useNextra must be used within NextraProvider');
  }
  return context;
}
