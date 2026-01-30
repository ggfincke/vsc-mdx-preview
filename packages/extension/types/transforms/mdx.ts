// packages/extension/types/transforms/mdx.ts
// type definitions for MDX AST transforms

import type { RootContent, BlockContent, PhrasingContent } from 'mdast';

// MDX JSX attribute node
export interface MdxJsxAttribute {
  type: 'mdxJsxAttribute';
  name: string;
  value: string | { type: string; value: string } | null;
}

// MDX JSX element node (flow or text)
export interface MdxJsxElement {
  type: 'mdxJsxFlowElement' | 'mdxJsxTextElement';
  name: string | null;
  attributes: MdxJsxAttribute[];
  children: Array<BlockContent | PhrasingContent>;
  // optional position for diagnostics & IDE features
  position?: {
    start: { line: number; column: number; offset?: number };
    end: { line: number; column: number; offset?: number };
  };
}

// configuration for creating AST nodes
export interface NodeConfig {
  type: string;
  hName: string;
  className: string | string[];
  children: unknown[];
  additionalProps?: Record<string, unknown>;
}

// transform function signature for MDX element transforms
export type TransformFunction = (node: MdxJsxElement) => RootContent;

// callout/admonition types supported in Safe Mode
export type CalloutType =
  | 'note'
  | 'tip'
  | 'warning'
  | 'danger'
  | 'info'
  | 'caution'
  | 'important';
