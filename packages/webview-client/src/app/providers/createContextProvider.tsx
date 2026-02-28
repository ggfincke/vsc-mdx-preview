// packages/webview-client/src/app/providers/createContextProvider.tsx
// factory for creating React context w/ provider & hook (eliminates repeated boilerplate)

import { createContext, useContext, type ReactNode } from 'react';

interface ContextProviderResult<T> {
  Provider: React.FC<{ children: ReactNode }>;
  useContextValue: () => T;
}

// create a context provider & hook pair from a value hook
export function createContextProvider<T>(
  name: string,
  useProviderValue: () => T
): ContextProviderResult<T> {
  const Context = createContext<T | null>(null);

  function Provider({ children }: { children: ReactNode }) {
    const value = useProviderValue();
    return <Context.Provider value={value}>{children}</Context.Provider>;
  }

  function useContextValue(): T {
    const context = useContext(Context);
    if (!context) {
      throw new Error(`use${name} must be used within ${name}Provider`);
    }
    return context;
  }

  return { Provider, useContextValue };
}
