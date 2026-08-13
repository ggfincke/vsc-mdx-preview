#!/usr/bin/env node
// scripts/check-comment-style.mjs
// enforce comment-style guardrails that can be checked mechanically

import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { collectFiles, normalizePath } from './lib/file-walk.mjs';
import { IGNORED_DIRECTORIES } from './lib/ignore.mjs';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs']);
const IGNORED_PATH_PREFIXES = [
  'packages/webview-client/public/vendor/',
  'packages/webview-client/src/generated/',
];

function getScriptKind(relativePath) {
  if (relativePath.endsWith('.tsx')) {
    return ts.ScriptKind.TSX;
  }

  if (relativePath.endsWith('.ts')) {
    return ts.ScriptKind.TS;
  }

  return ts.ScriptKind.JS;
}

function getCommentText(text, position) {
  const lineEnd = text.indexOf('\n', position);
  const end = lineEnd === -1 ? text.length : lineEnd;
  return text.slice(position + 2, end).trim();
}

function hasCodeBeforeComment(text, position) {
  const lineStart = text.lastIndexOf('\n', position - 1) + 1;
  const beforeComment = text.slice(lineStart, position);
  return /\S/.test(beforeComment);
}

function isPathHeaderComment(commentText) {
  return /^[*!?]?\s*[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+\.(?:ts|tsx|js|mjs)$/.test(
    commentText
  );
}

function formatSnippet(commentText) {
  if (commentText.length <= 100) {
    return commentText;
  }

  return `${commentText.slice(0, 97)}...`;
}

function collectFileHeaderViolations(filePath, text, output) {
  const lines = text.split(/\r?\n/);
  const headerIndex = lines[0]?.startsWith('#!') ? 1 : 0;
  const headerPath = lines[headerIndex] ?? '';
  const headerDescription = lines[headerIndex + 1] ?? '';
  const expectedHeaderPath = `// ${filePath}`;

  if (headerPath !== expectedHeaderPath) {
    output.push({
      file: filePath,
      line: headerIndex + 1,
      rule: 'file-header-path',
      detail: `expected ${expectedHeaderPath}`,
    });
  }

  if (
    !headerDescription.startsWith('// ') ||
    headerDescription.trim() === '//' ||
    headerDescription === expectedHeaderPath
  ) {
    output.push({
      file: filePath,
      line: headerIndex + 2,
      rule: 'file-header-description',
      detail: 'add a description comment below the path header',
    });
  }
}

function collectAllowedBlockDocPositions(sourceFile, text) {
  const positions = new Set();

  function visit(node) {
    if (
      ts.isClassDeclaration(node) ||
      ts.isClassExpression(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isEnumDeclaration(node)
    ) {
      const leadingComments =
        ts.getLeadingCommentRanges(text, node.getFullStart()) ?? [];
      for (const range of leadingComments) {
        const isBlockDoc =
          range.kind === ts.SyntaxKind.MultiLineCommentTrivia &&
          text.startsWith('/**', range.pos);
        const gap = text.slice(range.end, node.getStart(sourceFile));
        const newlineCount = gap.match(/\r?\n/g)?.length ?? 0;
        const isAttached = !/\S/.test(gap) && newlineCount === 1;
        if (isBlockDoc && isAttached) {
          positions.add(range.pos);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return positions;
}

function isSentenceStyleBlockDoc(text, range) {
  const lines = text
    .slice(range.pos + 3, range.end - 2)
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\*?\s?/, '').trim());
  const summaryLines = [];
  for (const line of lines) {
    if (!line || line.startsWith('@')) {
      if (summaryLines.length > 0) {
        break;
      }
      continue;
    }
    summaryLines.push(line);
  }
  const summary = summaryLines.join(' ');
  return /^[A-Z]/.test(summary) && /\.(?:[`'"\])}]*)$/.test(summary);
}

function collectCommentViolations(
  filePath,
  sourceFile,
  text,
  range,
  allowedBlockDocs,
  output
) {
  const line = sourceFile.getLineAndCharacterOfPosition(range.pos).line + 1;

  if (range.kind === ts.SyntaxKind.MultiLineCommentTrivia) {
    if (!allowedBlockDocs.has(range.pos)) {
      output.push({
        file: filePath,
        line,
        rule: 'block-comment-scope',
        detail: 'use block docs only on classes, interfaces, or enums',
      });
    } else if (!isSentenceStyleBlockDoc(text, range)) {
      output.push({
        file: filePath,
        line,
        rule: 'block-doc-style',
        detail: 'capitalize & terminate the block-doc sentence',
      });
    }
    return;
  }

  const commentText = getCommentText(text, range.pos);

  if (hasCodeBeforeComment(text, range.pos)) {
    output.push({
      file: filePath,
      line,
      rule: 'inline-comment',
      detail: formatSnippet(commentText || '//'),
    });
  }

  if (!commentText) {
    return;
  }

  if (/[→⇒]/.test(commentText)) {
    output.push({
      file: filePath,
      line,
      rule: 'unicode-arrow',
      detail: formatSnippet(commentText),
    });
  }

  if (!isPathHeaderComment(commentText) && /[.!?;:]$/.test(commentText)) {
    output.push({
      file: filePath,
      line,
      rule: 'punctuation',
      detail: formatSnippet(commentText),
    });
  }
}

function scanFile(rootDir, relativePath) {
  const absolutePath = join(rootDir, relativePath);
  const text = readFileSync(absolutePath, 'utf-8');
  const violations = [];
  collectFileHeaderViolations(relativePath, text, violations);
  const sourceFile = ts.createSourceFile(
    relativePath,
    text,
    ts.ScriptTarget.Latest,
    false,
    getScriptKind(relativePath)
  );
  const allowedBlockDocs = collectAllowedBlockDocPositions(sourceFile, text);
  const seenCommentPositions = new Set();

  function recordComment(range) {
    if (seenCommentPositions.has(range.pos)) {
      return;
    }

    seenCommentPositions.add(range.pos);
    collectCommentViolations(
      relativePath,
      sourceFile,
      text,
      range,
      allowedBlockDocs,
      violations
    );
  }

  function visit(node) {
    const leadingComments =
      ts.getLeadingCommentRanges(text, node.getFullStart()) ?? [];
    for (const range of leadingComments) {
      recordComment(range);
    }

    const trailingComments = ts.getTrailingCommentRanges(text, node.end) ?? [];
    for (const range of trailingComments) {
      recordComment(range);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

try {
  const rootDir = process.cwd();
  const sourceFiles = collectFiles({
    rootDir,
    extensions: SOURCE_EXTENSIONS,
    ignoredDirectories: IGNORED_DIRECTORIES,
    pathMode: 'relative',
    includeFile: (absolutePath) => {
      const relativePath = normalizePath(relative(rootDir, absolutePath));
      return !IGNORED_PATH_PREFIXES.some((pathPrefix) =>
        relativePath.startsWith(pathPrefix)
      );
    },
  });

  const violations = [];
  for (const filePath of sourceFiles) {
    violations.push(...scanFile(rootDir, filePath));
  }

  violations.sort(
    (left, right) =>
      left.file.localeCompare(right.file) ||
      left.line - right.line ||
      left.rule.localeCompare(right.rule)
  );

  if (violations.length > 0) {
    console.error(
      `Comment style check FAILED (${violations.length} violation(s))`
    );
    console.error(
      'Rules: require file headers, no inline comments, ASCII arrows, no trailing plain-comment punctuation, block docs only on large types'
    );
    console.error('');

    for (const violation of violations) {
      console.error(
        `${violation.file}:${violation.line} [${violation.rule}] ${violation.detail}`
      );
    }

    process.exit(1);
  }

  console.log(
    `Comment style check passed (${sourceFiles.length} file(s) scanned)`
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Error checking comment style:', message);
  process.exit(1);
}
