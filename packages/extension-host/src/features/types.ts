// packages/extension-host/src/features/types.ts
// feature-level type barrel

export * from './commands/types';
// compilation types sourced from mdx-forge/compiler (selective to avoid name conflicts)
export type { MdxJsxElement, MdxJsxAttribute } from 'mdx-forge/compiler';
export * from './diagnostics/types';
export * from './framework/types';
export * from './module-runtime/types/module-system';
export * from './module-runtime/types/handlers';
export * from './module-runtime/types/transpile';
export * from './module-runtime/types/resolver/file-prober';
export * from './module-runtime/types/resolver/strategies';
export * from './preview/types/preview';
export * from './preview/types/watcher';
export * from './security/types';
export * from './security/types/csp';
export * from './tailwind/types/detector';
export * from './tailwind/types/processor';
export * from './tailwind/types/scanning';
export * from './themes/types';
export * from '../shared/config/types';
