// packages/extension-host/src/features/language/MDXSymbolProvider.ts
// provide document symbols for MDX files (headings, frontmatter, imports, exports)

import * as vscode from 'vscode';
import { visit } from 'unist-util-visit';
import { createTaggedLogger } from '../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import { extractErrorMessage } from '@mdx-preview/runtime-utils';
import {
  analyzeMdxDocument,
  astPositionToRange,
} from '../../shared/mdx-analysis/document-analysis';
import { describeEsmStatement } from '../../shared/mdx-analysis/esm-imports';
import type {
  MdastPosition,
  MdxjsEsmNode,
} from '../../shared/mdx-analysis/types';

const log = createTaggedLogger(LogTags.SYMBOL_PROVIDER);

// heading AST node
interface HeadingNode {
  type: 'heading';
  depth: 1 | 2 | 3 | 4 | 5 | 6;
  children: Array<{
    type: string;
    value?: string;
    children?: Array<{ type: string; value?: string }>;
  }>;
  position?: MdastPosition;
}

// extract text content from heading children nodes
function extractHeadingText(
  children: Array<{
    type: string;
    value?: string;
    children?: Array<{ type: string; value?: string }>;
  }>
): string {
  const parts: string[] = [];
  for (const child of children) {
    if (child.type === 'text' || child.type === 'inlineCode') {
      if (child.value) {
        parts.push(child.value);
      }
    } else if (child.children) {
      // recurse into emphasis, strong, link, etc
      parts.push(extractHeadingText(child.children));
    }
  }
  return parts.join('');
}

// markdown depths 1..6 plus reserved index 0 so depth indexes the lookup directly
const MAX_HEADING_DEPTH = 6;

function computeHeadingSectionEndLines(
  headings: Array<{ depth: number; range: vscode.Range }>,
  lastLine: number
): number[] {
  const endLines = new Array<number>(headings.length);
  const nextStartLineByDepth: Array<number | undefined> = Array(
    MAX_HEADING_DEPTH + 1
  ).fill(undefined);

  for (let i = headings.length - 1; i >= 0; i -= 1) {
    const { depth, range } = headings[i];
    let nextSameOrHigherStartLine: number | undefined;

    for (let candidateDepth = 1; candidateDepth <= depth; candidateDepth += 1) {
      const candidateLine = nextStartLineByDepth[candidateDepth];
      if (
        candidateLine !== undefined &&
        (nextSameOrHigherStartLine === undefined ||
          candidateLine < nextSameOrHigherStartLine)
      ) {
        nextSameOrHigherStartLine = candidateLine;
      }
    }

    endLines[i] =
      nextSameOrHigherStartLine !== undefined
        ? Math.max(nextSameOrHigherStartLine - 1, range.start.line)
        : lastLine;
    nextStartLineByDepth[depth] = range.start.line;
  }

  return endLines;
}

// build nested heading hierarchy from flat heading list
function buildHeadingHierarchy(
  headings: Array<{ depth: number; text: string; range: vscode.Range }>,
  document: vscode.TextDocument
): vscode.DocumentSymbol[] {
  const root: vscode.DocumentSymbol[] = [];
  const stack: Array<{ depth: number; symbol: vscode.DocumentSymbol }> = [];
  const lastLine = document.lineCount - 1;
  const sectionEndLines = computeHeadingSectionEndLines(headings, lastLine);

  for (let i = 0; i < headings.length; i++) {
    const { depth, text, range } = headings[i];
    const endLine = sectionEndLines[i];
    const endLineText = document.lineAt(Math.min(endLine, lastLine)).text;
    const fullRange = new vscode.Range(
      range.start,
      new vscode.Position(endLine, endLineText.length)
    );

    const symbol = new vscode.DocumentSymbol(
      text || '(untitled)',
      '',
      vscode.SymbolKind.String,
      fullRange,
      range
    );

    // pop stack entries at same or deeper depth
    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    // add to parent or root
    if (stack.length > 0) {
      stack[stack.length - 1].symbol.children.push(symbol);
    } else {
      root.push(symbol);
    }

    stack.push({ depth, symbol });
  }

  return root;
}

// create frontmatter symbol from pre-parsed boundaries
function createFrontmatterSymbol(
  data: Record<string, unknown>,
  lines: string[],
  endLine: number
): vscode.DocumentSymbol | null {
  if (Object.keys(data).length === 0 || endLine === 0) {
    return null;
  }

  const fullRange = new vscode.Range(0, 0, endLine, 3);
  const selectionRange = new vscode.Range(0, 0, 0, 3);

  const symbol = new vscode.DocumentSymbol(
    'Frontmatter',
    '',
    vscode.SymbolKind.Struct,
    fullRange,
    selectionRange
  );

  // add individual fields as children
  for (let i = 1; i < endLine; i++) {
    const line = lines[i];
    const keyMatch = line.match(/^(\w[\w-]*)\s*:/);
    if (keyMatch) {
      const fieldSymbol = new vscode.DocumentSymbol(
        keyMatch[1],
        '',
        vscode.SymbolKind.Property,
        new vscode.Range(i, 0, i, line.length),
        new vscode.Range(i, 0, i, keyMatch[1].length)
      );
      symbol.children.push(fieldSymbol);
    }
  }

  return symbol;
}

// create import/export symbols from ESM nodes
function createEsmSymbols(
  esmNodes: Array<{ value: string; range: vscode.Range }>
): vscode.DocumentSymbol[] {
  const symbols: vscode.DocumentSymbol[] = [];

  for (const node of esmNodes) {
    const trimmed = node.value.trimStart();
    const isImport = trimmed.startsWith('import');
    const isExport = trimmed.startsWith('export');

    if (!isImport && !isExport) {
      continue;
    }

    const name = describeEsmStatement(node.value);
    const kind = isImport
      ? vscode.SymbolKind.Module
      : vscode.SymbolKind.Variable;

    symbols.push(
      new vscode.DocumentSymbol(
        name,
        isImport ? 'import' : 'export',
        kind,
        node.range,
        node.range
      )
    );
  }

  return symbols;
}

// extract symbols from an MDX document (shared between provider & tree view)
export function extractMDXSymbols(
  document: vscode.TextDocument
): vscode.DocumentSymbol[] {
  const text = document.getText();
  const {
    ast: tree,
    frontmatter: fmData,
    frontmatterLineOffset,
    frontmatterColumnOffset,
    frontmatterEndLine,
  } = analyzeMdxDocument(text);

  const symbols: vscode.DocumentSymbol[] = [];

  // frontmatter symbol (only frontmatter lines are read, so cap the split)
  const lines =
    frontmatterEndLine > 0 ? text.split('\n', frontmatterEndLine) : [];
  const fmSymbol = createFrontmatterSymbol(fmData, lines, frontmatterEndLine);
  if (fmSymbol) {
    symbols.push(fmSymbol);
  }

  // collect ESM nodes (imports/exports)
  const esmNodes: Array<{ value: string; range: vscode.Range }> = [];
  visit(tree, 'mdxjsEsm', (node) => {
    const esmNode = node as unknown as MdxjsEsmNode;
    if (esmNode.position) {
      const range = astPositionToRange(
        esmNode.position,
        frontmatterLineOffset,
        frontmatterColumnOffset
      );
      esmNodes.push({ value: esmNode.value, range });
    }
  });
  symbols.push(...createEsmSymbols(esmNodes));

  // collect heading nodes
  const headings: Array<{
    depth: number;
    text: string;
    range: vscode.Range;
  }> = [];
  visit(tree, 'heading', (node) => {
    const heading = node as unknown as HeadingNode;
    if (heading.position) {
      const range = astPositionToRange(
        heading.position,
        frontmatterLineOffset,
        frontmatterColumnOffset
      );
      headings.push({
        depth: heading.depth,
        text: extractHeadingText(heading.children),
        range,
      });
    }
  });
  symbols.push(...buildHeadingHierarchy(headings, document));

  return symbols;
}

// * MDXSymbolProvider
// provide document symbols for MDX headings, frontmatter & ESM statements
export class MDXSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.DocumentSymbol[] | undefined {
    const text = document.getText();
    if (!text.trim()) {
      return [];
    }

    try {
      const symbols = extractMDXSymbols(document);
      log.debug(`Found ${symbols.length} symbols`);
      return symbols;
    } catch (err) {
      log.warn(`Parse error: ${extractErrorMessage(err)}`);
      return undefined;
    }
  }
}
