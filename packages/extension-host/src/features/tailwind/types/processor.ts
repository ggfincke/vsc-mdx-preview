// packages/extension-host/src/features/tailwind/types/processor.ts
// type definitions for Tailwind CSS processing

import type { TrustState } from '@mdx-preview/contracts';
import type { TailwindConfig } from '../../../shared/config/types';
import type { Preview } from '../../preview/preview-manager';
import type { TailwindProfileDetectionResult } from './detector';

export type TailwindRuntimeProfile = 'disabled' | 'browser' | 'advanced';

// options for lightweight profile detection (routing only)
export interface TailwindProfileOptions {
  preview: Preview;
  mdxText: string;
  tailwindConfig: TailwindConfig;
}

// options for Tailwind CSS processing
export interface TailwindProcessOptions {
  preview: Preview;
  mdxText: string;
  entryFilePath: string;
  entryFileDependencies: string[];
  trustState: TrustState;
  tailwindConfig: TailwindConfig;
  profileHint?: TailwindProfileDetectionResult;
}

// result of Tailwind CSS processing
export interface TailwindProcessResult {
  profile: TailwindRuntimeProfile;
  profileReason?: string;
  css: string;
  watchFiles: string[];
  enabled: boolean;
}
