// packages/webview-app/src/context/TrustContext.tsx
// React context for trust state - manages workspace trust & script execution permissions

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type { TrustState } from '../types';
import { debug } from '../utils/debug';

interface TrustContextValue {
  trustState: TrustState;
  setTrustState: (state: TrustState) => void;
}

// initial trust state (Safe Mode by default)
const INITIAL_TRUST_STATE: TrustState = {
  workspaceTrusted: false,
  scriptsEnabled: false,
  canExecute: false,
  openMdxLinksInPreview: true,
};

const TrustContext = createContext<TrustContextValue | null>(null);

interface TrustProviderProps {
  children: ReactNode;
}

export function TrustProvider({ children }: TrustProviderProps) {
  const [trustState, setTrustStateInternal] = useState<TrustState>(INITIAL_TRUST_STATE);

  const setTrustState = useCallback((state: TrustState) => {
    debug('[TRUST-CONTEXT] setTrustState called', state);
    setTrustStateInternal(state);
  }, []);

  const value = useMemo(
    () => ({ trustState, setTrustState }),
    [trustState, setTrustState]
  );

  return (
    <TrustContext.Provider value={value}>{children}</TrustContext.Provider>
  );
}

export function useTrust(): TrustContextValue {
  const context = useContext(TrustContext);
  if (!context) {
    throw new Error('useTrust must be used within TrustProvider');
  }
  return context;
}
