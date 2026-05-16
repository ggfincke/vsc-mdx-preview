#!/usr/bin/env node
// scripts/check-comment-style.mjs
// enforce comment-style guardrails that can be checked mechanically

import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import ts from 'typescript';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs']);
const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.vscode-test',
  'archive',
  'build',
  'coverage',
  'dev-docs',
  'dist',
  'node_modules',
]);
const IGNORED_PATH_PREFIXES = [
  'packages/webview-client/public/vendor/',
  'packages/webview-client/src/generated/',
];

function normalizePath(filePath) {
  return filePath.replaceAll('\\', '/');
}

function collectSourceFiles(rootDir, currentDir, output) {
  const entries = readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      collectSourceFiles(rootDir, absolutePath, output);
      continue;
    }

    if (!SOURCE_EXTENSIONS.has(extname(entry.name))) {
      continue;
    }

    const relativePath = normalizePath(relative(rootDir, absolutePath));
    if (
      IGNORED_PATH_PREFIXES.some((pathPrefix) =>
        relativePath.startsWith(pathPrefix)
      )
    ) {
      continue;
    }

    output.push(relativePath);
  }
}

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

function collectCommentBlockLengthViolations(filePath, text, output) {
  const lines = text.split(/\r?\n/);
  let blockStartLine = 0;
  let blockLength = 0;

  const flushBlock = () => {
    if (blockLength > 3) {
      output.push({
        file: filePath,
        line: blockStartLine,
        rule: 'comment-block-length',
        detail: `${blockLength} consecutive // lines`,
      });
    }
    blockStartLine = 0;
    blockLength = 0;
  };

  lines.forEach((lineText, index) => {
    if (/^\s*\/\//.test(lineText)) {
      if (blockLength === 0) {
        blockStartLine = index + 1;
      }
      blockLength += 1;
      return;
    }

    flushBlock();
  });

  flushBlock();
}

function collectCommentViolations(filePath, sourceFile, text, range, output) {
  const line = sourceFile.getLineAndCharacterOfPosition(range.pos).line + 1;

  if (range.kind === ts.SyntaxKind.MultiLineCommentTrivia) {
    output.push({
      file: filePath,
      line,
      rule: 'block-comment',
      detail: 'use // comments only',
    });
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

  if (/\b(and|with)\b/i.test(commentText)) {
    output.push({
      file: filePath,
      line,
      rule: 'wording',
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
  collectCommentBlockLengthViolations(relativePath, text, violations);
  const sourceFile = ts.createSourceFile(
    relativePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(relativePath)
  );
  const seenCommentPositions = new Set();

  function recordComment(range) {
    if (seenCommentPositions.has(range.pos)) {
      return;
    }

    seenCommentPositions.add(range.pos);
    collectCommentViolations(relativePath, sourceFile, text, range, violations);
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
  const sourceFiles = [];

  collectSourceFiles(rootDir, rootDir, sourceFiles);

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
      'Rules: require file headers, no block comments, no inline comments, max 3 // lines, use &/w/, no trailing punctuation'
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
