// packages/extension-host/src/features/language/mdx-document-analysis.ts
// shared MDX document parsing & analysis (frontmatter, AST, offset calculation)
// used by MDXSymbolProvider, MDXCompletionProvider & ComponentDetector

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import matter from 'gray-matter';
import type { Root } from 'mdast';

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
  const matterResult = matter(text);
  const lines = text.split('\n');

  // calculate line offset for AST positions (gray-matter strips frontmatter)
  // find the closing --- line in the original text to get exact offset
  let frontmatterLineOffset = 0;
  let frontmatterEndLine = 0;
  const hasFrontmatter = Boolean(matterResult.matter);

  if (hasFrontmatter) {
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

// lightweight frontmatter boundary detection (no AST parse)
// return whether `line` (0-based) is inside the frontmatter region
export function isLineInFrontmatter(text: string, line: number): boolean {
  if (line === 0) {
    return false;
  }

  const lines = text.split('\n');
  if (lines[0]?.trim() !== '---') {
    return false;
  }

  // find closing ---
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      // cursor must be between opening & closing delimiters (exclusive)
      return line > 0 && line < i;
    }
  }

  // no closing --- found yet, still in frontmatter
  return true;
}

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
      return line > 0 && line < i;
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
