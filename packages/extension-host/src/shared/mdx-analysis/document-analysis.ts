// packages/extension-host/src/shared/mdx-analysis/document-analysis.ts
// parse MDX documents & map AST positions to document coordinates

import * as vscode from 'vscode';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import { extractFrontmatter } from 'mdx-forge/compiler';
import { LRUCache } from '@mdx-preview/runtime-utils';
import type { Root } from 'mdast';
import type { MdastPosition } from './types';

// reusable parser instance (stateless, safe to share across calls)
const mdxParser = unified().use(remarkParse).use(remarkMdx);

export interface DocumentAnalysisIdentity {
  uri: string;
  version: number;
}

// parsed MDX document w/ frontmatter data & line offset for AST positions
export interface MdxDocumentAnalysis {
  // parsed AST (from content w/ frontmatter stripped)
  ast: Root;
  // frontmatter data (parsed YAML)
  frontmatter: Record<string, unknown>;
  // stripped content (post-frontmatter)
  content: string;
  // number of lines to add to AST positions to get original document positions
  // accounts for frontmatter lines stripped by gray-matter
  frontmatterLineOffset: number;
  // number of columns to add to first-line AST positions
  frontmatterColumnOffset: number;
  // 0-based line number of the closing --- delimiter (0 if no frontmatter)
  frontmatterEndLine: number;
  // whether the document has frontmatter
  hasFrontmatter: boolean;
}

interface CachedDocumentAnalysis {
  version: number;
  analysis: MdxDocumentAnalysis;
}

const analysisCache = new LRUCache<string, CachedDocumentAnalysis>({
  maxEntries: 50,
  maxMemoryBytes: 64 * 1024 * 1024,
  estimateSize: ({ analysis }) => analysis.content.length * 4,
});

// parse an MDX document & extract frontmatter, AST & line offset
export function analyzeMdxDocument(
  text: string,
  identity?: DocumentAnalysisIdentity
): MdxDocumentAnalysis {
  if (identity) {
    const cached = analysisCache.get(identity.uri);
    if (cached?.version === identity.version) {
      return cached.analysis;
    }
  }

  const matterResult = extractFrontmatter(text);
  const hasFrontmatter =
    matterResult.bodyStartLine > 1 || matterResult.bodyStartColumn > 1;
  const frontmatterLineOffset = hasFrontmatter
    ? matterResult.bodyStartLine - 1
    : 0;
  const frontmatterColumnOffset = hasFrontmatter
    ? matterResult.bodyStartColumn - 1
    : 0;
  const frontmatterEndLine = hasFrontmatter
    ? matterResult.bodyStartLine - (matterResult.bodyStartColumn > 1 ? 1 : 2)
    : 0;

  const ast = mdxParser.parse(matterResult.content) as Root;

  const analysis = {
    ast,
    frontmatter: matterResult.frontmatter,
    content: matterResult.content,
    frontmatterLineOffset,
    frontmatterColumnOffset,
    frontmatterEndLine,
    hasFrontmatter,
  };

  // share ASTs only among read-only consumers for the exact document version
  if (identity) {
    analysisCache.set(identity.uri, {
      version: identity.version,
      analysis,
    });
  }

  return analysis;
}

export function invalidateMdxAnalysisCache(uri: string): void {
  analysisCache.delete(uri);
}

export function clearMdxAnalysisCache(): void {
  analysisCache.clear();
}

// frontmatter boundary check via TextDocument.lineAt (no full-text materialisation)
export function isDocumentLineInFrontmatter(
  document: { lineAt(line: number): { text: string }; lineCount: number },
  line: number
): boolean {
  if (line === 0) {
    return false;
  }

  if (document.lineAt(0).text.trim() !== '---') {
    return false;
  }

  const lastLine = Math.min(line, document.lineCount - 1);
  for (let i = 1; i <= lastLine; i++) {
    if (document.lineAt(i).text.trim() === '---') {
      return line < i;
    }
  }

  return true;
}

// convert AST position to 0-based line number (adjusting for frontmatter offset)
export function astLineToDocumentLine(
  astLine: number,
  frontmatterLineOffset: number
): number {
  return astLine - 1 + frontmatterLineOffset;
}

// convert a 1-based mdast position to a 0-based document Range (frontmatter-adjusted)
export function astPositionToRange(
  position: MdastPosition,
  frontmatterLineOffset: number,
  frontmatterColumnOffset = 0
): vscode.Range {
  const startCharacter =
    position.start.column -
    1 +
    (position.start.line === 1 ? frontmatterColumnOffset : 0);
  const endCharacter =
    position.end.column -
    1 +
    (position.end.line === 1 ? frontmatterColumnOffset : 0);
  return new vscode.Range(
    astLineToDocumentLine(position.start.line, frontmatterLineOffset),
    startCharacter,
    astLineToDocumentLine(position.end.line, frontmatterLineOffset),
    endCharacter
  );
}
