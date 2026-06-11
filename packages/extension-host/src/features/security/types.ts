// packages/extension-host/src/features/security/types.ts
// type definitions for security & trust management

// re-export TrustState from shared
export type { TrustState } from '@mdx-preview/contracts';

// result of checking Trusted Mode availability for document
export interface TrustedModeCheck {
  allowed: boolean;
  reason?: string;
}
