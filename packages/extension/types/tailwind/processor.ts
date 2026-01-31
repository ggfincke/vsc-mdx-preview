// packages/extension/types/tailwind/processor.ts
// type definitions for Tailwind CSS processing

import type { TrustState } from '@mdx-preview/shared';
import type { TailwindConfig } from '../core/config';
import type { Preview } from '../../preview/preview-manager';

// options for Tailwind CSS processing
export interface TailwindProcessOptions {
  preview: Preview;
  mdxText: string;
  entryFilePath: string;
  entryFileDependencies: string[];
  trustState: TrustState;
  tailwindConfig: TailwindConfig;
}

// result of Tailwind CSS processing
export interface TailwindProcessResult {
  css: string;
  watchFiles: string[];
  enabled: boolean;
}
