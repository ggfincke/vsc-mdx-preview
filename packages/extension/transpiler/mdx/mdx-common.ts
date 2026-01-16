// packages/extension/transpiler/mdx/mdx-common.ts
// shared utilities for MDX compilation (trusted and safe modes)

import matter from 'gray-matter';

// import and re-export types from consolidated types file
export type { UnknownBehavior, FrontmatterResult } from '../types';
import type { FrontmatterResult, UnknownBehavior } from '../types';

// extract frontmatter from MDX text using gray-matter
// returns the content without frontmatter & the parsed frontmatter data
export function extractFrontmatter(mdxText: string): FrontmatterResult {
  const { content, data } = matter(mdxText);
  return {
    content,
    frontmatter: data as Record<string, unknown>,
  };
}

// get the effective unknown component behavior
// resolves the behavior from config or returns the default
export function getUnknownBehavior(
  configBehavior: UnknownBehavior | undefined,
  defaultBehavior: UnknownBehavior = 'placeholder'
): UnknownBehavior {
  return configBehavior ?? defaultBehavior;
}

// common frontmatter keys that affect preview behavior
export const PREVIEW_FRONTMATTER_KEYS = [
  'previewTheme',
  'codeBlockTheme',
] as const;

// check if frontmatter has any preview-related keys
export function hasPreviewFrontmatter(
  frontmatter: Record<string, unknown>
): boolean {
  return PREVIEW_FRONTMATTER_KEYS.some((key) => key in frontmatter);
}

// extract preview-related frontmatter values (only keys w/ string values)
export function extractPreviewFrontmatter(
  frontmatter: Record<string, unknown>
): Partial<Record<(typeof PREVIEW_FRONTMATTER_KEYS)[number], string>> {
  const result: Partial<
    Record<(typeof PREVIEW_FRONTMATTER_KEYS)[number], string>
  > = {};

  for (const key of PREVIEW_FRONTMATTER_KEYS) {
    const value = frontmatter[key];
    if (typeof value === 'string') {
      result[key] = value;
    }
  }

  return result;
}
