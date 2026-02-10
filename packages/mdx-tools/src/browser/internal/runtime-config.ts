import {
  DEFAULT_MAX_CONCURRENT_FETCHES,
  DEFAULT_MAX_MODULE_LOAD_DEPTH,
} from './constants';
import type { MDXRuntime, ModuleLoaderConfig } from '../types';

const MISSING_RUNTIME_FN = () => {
  throw new Error(
    'MDX runtime is not configured. Provide jsx/jsxs/Fragment via configureModuleLoader().'
  );
};

const defaultRuntime: MDXRuntime = {
  Fragment: null,
  jsx: MISSING_RUNTIME_FN,
  jsxs: MISSING_RUNTIME_FN,
};

interface RuntimeState {
  maxModuleLoadDepth: number;
  maxConcurrentFetches: number;
  preloadAliases: Record<string, string>;
  runtime: MDXRuntime;
}

const state: RuntimeState = {
  maxModuleLoadDepth: DEFAULT_MAX_MODULE_LOAD_DEPTH,
  maxConcurrentFetches: DEFAULT_MAX_CONCURRENT_FETCHES,
  preloadAliases: {},
  runtime: defaultRuntime,
};

export function configureModuleLoader(config: ModuleLoaderConfig): void {
  if (config.maxModuleLoadDepth !== undefined) {
    state.maxModuleLoadDepth = config.maxModuleLoadDepth;
  }
  if (config.maxConcurrentFetches !== undefined) {
    state.maxConcurrentFetches = config.maxConcurrentFetches;
  }
  if (config.preloadAliases !== undefined) {
    state.preloadAliases = { ...config.preloadAliases };
  }
  if (config.runtime !== undefined) {
    state.runtime = {
      ...state.runtime,
      ...config.runtime,
    };
  }
}

export function getModuleLoaderConfig(): RuntimeState {
  return state;
}
