// packages/extension/types/framework/index.ts
// type definitions for framework detection

import type { FrameworkId } from '@mdx-preview/shared';

// re-export FrameworkId from shared
export type { FrameworkId } from '@mdx-preview/shared';

// framework detection result
export interface FrameworkInfo {
  framework: FrameworkId;
  // true = auto-detected, false = from setting
  detected: boolean;
  version?: string;
}
