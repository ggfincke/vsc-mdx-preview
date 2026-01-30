// packages/extension/types/index.ts
// centralized type exports for the extension package

// core domain types (no VS Code dependency)
export * from './core';

// VS Code-dependent types
export * from './vscode';

// subsystem types
export * from './services';
export * from './security';
export * from './tailwind';
export * from './framework';
export * from './transforms';
export * from './handlers';
export * from './resolver';
