// packages/extension/types/security/index.ts
// type definitions for security & trust management

import type { TrustState } from '@mdx-preview/contracts';

// re-export TrustState from shared
export type { TrustState } from '@mdx-preview/contracts';

// security mode enum for explicit type safety
export enum SecurityMode {
  Safe = 'safe',
  Trusted = 'trusted',
}

// derive SecurityMode from TrustState
export function getSecurityMode(state: TrustState): SecurityMode {
  return state.canExecute ? SecurityMode.Trusted : SecurityMode.Safe;
}

// result of checking Trusted Mode availability for document
export interface TrustedModeCheck {
  allowed: boolean;
  reason?: string;
}
