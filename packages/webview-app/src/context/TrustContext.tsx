// packages/webview-app/src/context/TrustContext.tsx
// React context for trust state - manage workspace trust & script execution permissions

import { useState, useCallback, useMemo } from 'react';
import type { TrustState } from '../types';
import { debug } from '../utils/debug';
import { LogTags } from '@mdx-preview/shared';
import { createContextProvider } from './createContextProvider';

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

// hook that provides the Trust context value
function useTrustProviderValue(): TrustContextValue {
  const [trustState, setTrustStateInternal] = useState<TrustState>(INITIAL_TRUST_STATE);

  const setTrustState = useCallback((state: TrustState) => {
    debug(`[${LogTags.TRUST_CONTEXT}] setTrustState called`, state);
    setTrustStateInternal(state);
  }, []);

  return useMemo(
    () => ({ trustState, setTrustState }),
    [trustState, setTrustState]
  );
}

const { Provider, useContextValue } = createContextProvider<TrustContextValue>(
  'Trust',
  useTrustProviderValue
);

export const TrustProvider = Provider;
export const useTrust = useContextValue;
