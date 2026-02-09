// packages/contracts/src/frameworks.ts
// framework type aliases (canonical source for contracts & registry)

// framework IDs used by the shim registry
// Framework = frameworks w/ shims (excludes 'generic')
export type Framework = 'docusaurus' | 'starlight' | 'nextjs' | 'nextra';

// FrameworkId = all frameworks including 'generic' (canonical runtime type)
export type FrameworkId = Framework | 'generic';

// FrameworkSetting = VS Code setting type ('auto' triggers detection)
export type FrameworkSetting = 'auto' | FrameworkId;
