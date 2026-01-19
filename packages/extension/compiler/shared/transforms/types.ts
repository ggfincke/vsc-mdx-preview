// packages/extension/compiler/shared/transforms/types.ts
// shared types for Safe Mode component transforms

import type { RootContent, BlockContent, PhrasingContent } from 'mdast';

export interface MdxJsxAttribute {
  type: 'mdxJsxAttribute';
  name: string;
  value: string | { type: string; value: string } | null;
}

export interface MdxJsxElement {
  type: 'mdxJsxFlowElement' | 'mdxJsxTextElement';
  name: string | null;
  attributes: MdxJsxAttribute[];
  children: Array<BlockContent | PhrasingContent>;
}

export interface NodeConfig {
  type: string;
  hName: string;
  className: string | string[];
  children: unknown[];
  additionalProps?: Record<string, unknown>;
}

export type TransformFunction = (node: MdxJsxElement) => RootContent;
