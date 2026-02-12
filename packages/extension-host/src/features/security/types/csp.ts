// packages/extension/types/vscode/csp.ts
// type exports for Content Security Policy configuration

// Re-export SecurityPolicy from its canonical source
// Note: Defined in security/security.ts to avoid circular imports
export { SecurityPolicy } from '../security';

// re-export canonical CSP options type from runtime module
export type { CSPOptions } from '../CSP';
