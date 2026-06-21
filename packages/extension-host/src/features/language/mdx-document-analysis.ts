// packages/extension-host/src/features/language/mdx-document-analysis.ts
// shared MDX document parsing & analysis (frontmatter, AST, offset calculation)
// used by MDXSymbolProvider, MDXCompletionProvider & ComponentDetector

import * as vscode from 'vscode';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import { safeMatter } from 'mdx-forge/compiler';
import type { Root } from 'mdast';
import type { MdastPosition } from '../diagnostics/types';

// reusable parser instance (stateless, safe to share across calls)
const mdxParser = unified().use(remarkParse).use(remarkMdx);

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
  // 0-based line number of the closing --- delimiter (0 if no frontmatter)
  frontmatterEndLine: number;
  // whether the document has frontmatter
  hasFrontmatter: boolean;
}

// parse an MDX document & extract frontmatter, AST & line offset
export function analyzeMdxDocument(text: string): MdxDocumentAnalysis {
  // safeMatter neutralizes ---js / ---javascript eval (CWE-94); same shape as matter
  const matterResult = safeMatter(text);

  // calculate line offset for AST positions (gray-matter strips frontmatter)
  // find the closing --- line in the original text to get exact offset
  let frontmatterLineOffset = 0;
  let frontmatterEndLine = 0;
  // detect stripping directly: empty frontmatter strips but reports a falsy matter
  const hasFrontmatter = matterResult.content !== text;

  if (hasFrontmatter) {
    const lines = text.split('\n');
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        frontmatterEndLine = i;
        frontmatterLineOffset = i + 1;
        break;
      }
    }
  }

  // parse stripped content to AST
  const ast = mdxParser.parse(matterResult.content) as Root;

  return {
    ast,
    frontmatter: matterResult.data as Record<string, unknown>,
    content: matterResult.content,
    frontmatterLineOffset,
    frontmatterEndLine,
    hasFrontmatter,
  };
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
  frontmatterLineOffset: number
): vscode.Range {
  return new vscode.Range(
    astLineToDocumentLine(position.start.line, frontmatterLineOffset),
    position.start.column - 1,
    astLineToDocumentLine(position.end.line, frontmatterLineOffset),
    position.end.column - 1
  );
}
