// packages/extension/transpiler/mdx/mdx-common.ts
// shared utilities for MDX compilation (trusted & safe modes)

import matter from 'gray-matter';
import type { NextraPageMeta } from '@mdx-preview/shared-types';

// import and re-export types from consolidated types file
export type { UnknownBehavior, FrontmatterResult } from '../types';
import type { FrontmatterResult, UnknownBehavior } from '../types';

// extract frontmatter from MDX text w/ gray-matter (returns content & parsed data)
export function extractFrontmatter(mdxText: string): FrontmatterResult {
  const { content, data } = matter(mdxText);
  return {
    content,
    frontmatter: data as Record<string, unknown>,
  };
}

// get effective unknown component behavior (resolve from config or return default)
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

// Nextra-specific frontmatter keys
export const NEXTRA_FRONTMATTER_KEYS = [
  'title',
  'sidebarTitle', // Takes precedence over title
  'description',
  'layout', // 'default' | 'full' | 'raw'
] as const;

// extract Nextra-specific frontmatter fields for page metadata
export function extractNextraFrontmatter(
  frontmatter: Record<string, unknown>
): Partial<NextraPageMeta> {
  const result: Partial<NextraPageMeta> = {};

  // sidebarTitle takes precedence over title
  if (typeof frontmatter.sidebarTitle === 'string') {
    result.title = frontmatter.sidebarTitle;
  } else if (typeof frontmatter.title === 'string') {
    result.title = frontmatter.title;
  }

  if (typeof frontmatter.description === 'string') {
    result.description = frontmatter.description;
  }

  if (
    typeof frontmatter.layout === 'string' &&
    ['default', 'full', 'raw'].includes(frontmatter.layout)
  ) {
    result.layout = frontmatter.layout as 'default' | 'full' | 'raw';
  }

  return result;
}
