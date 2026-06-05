// packages/extension-host/src/features/language/MDXCompletionProvider.ts
// provide IntelliSense completions for MDX components, directives, alerts & frontmatter

import * as vscode from 'vscode';
import { createTaggedLogger } from '../../shared/logging/logger';
import {
  LogTags,
  FRONTMATTER_OVERRIDE_MAP,
  PREVIEW_THEMES,
  CODE_BLOCK_THEMES,
} from '@mdx-preview/contracts';
import type { FrameworkId } from '@mdx-preview/contracts';
import {
  COMPONENT_REGISTRY,
  getGenericComponentSnippets,
} from 'mdx-forge/components/registry';
import {
  VALID_CALLOUT_TYPES,
  GITHUB_ALERT_TYPES as GITHUB_ALERT_TYPE_LIST,
} from 'mdx-forge/compiler';
import { getFrameworkDetector } from '../../app/services';
import { isDocumentLineInFrontmatter } from './mdx-document-analysis';
import { EXTENSION_DISPLAY_NAME } from '../../shared/constants';

const log = createTaggedLogger(LogTags.COMPLETION_PROVIDER);

// completion context types
type CompletionContext =
  | 'jsx-tag'
  | 'directive'
  | 'github-alert'
  | 'frontmatter'
  | 'none';

// context detection patterns
const GITHUB_ALERT_PATTERN = />\s*\[!/;
const DIRECTIVE_PATTERN = /^:{3,}\s*\S*$/;
const JSX_TAG_PATTERN = /<[A-Z]?[a-zA-Z]*$/;

// detect completion context from line text & cursor position
function detectCompletionContext(
  document: vscode.TextDocument,
  position: vscode.Position
): CompletionContext {
  const line = document.lineAt(position.line).text;
  const textBeforeCursor = line.substring(0, position.character);

  // check if in frontmatter (between --- delimiters) via shared helper
  if (isDocumentLineInFrontmatter(document, position.line)) {
    return 'frontmatter';
  }

  // check for GitHub alert: > [! pattern
  if (GITHUB_ALERT_PATTERN.test(textBeforeCursor)) {
    return 'github-alert';
  }

  // check for directive: ::: at start of line
  if (DIRECTIVE_PATTERN.test(textBeforeCursor)) {
    return 'directive';
  }

  // check for JSX tag opening: < followed by optional PascalCase start
  if (JSX_TAG_PATTERN.test(textBeforeCursor)) {
    return 'jsx-tag';
  }

  return 'none';
}

// directive types derived from mdx-forge callout registry
const DIRECTIVE_TYPES = VALID_CALLOUT_TYPES.map((type) => ({ type }));

// GitHub-style alert types derived from mdx-forge
const GITHUB_ALERT_TYPES = GITHUB_ALERT_TYPE_LIST.map((type) => ({ type }));

// known frontmatter fields (common across MDX frameworks)
const FRONTMATTER_FIELDS = [
  { field: 'title', description: 'Page title', snippet: 'title: $0' },
  {
    field: 'description',
    description: 'Page description',
    snippet: 'description: $0',
  },
  {
    field: 'layout',
    description: 'Layout template',
    snippet: 'layout: ${1|default,full,raw|}',
  },
  {
    field: 'sidebar_position',
    description: 'Sidebar ordering (Docusaurus)',
    snippet: 'sidebar_position: ${1:0}',
  },
  {
    field: 'sidebar_label',
    description: 'Sidebar label (Docusaurus)',
    snippet: 'sidebar_label: $0',
  },
  { field: 'slug', description: 'URL slug override', snippet: 'slug: $0' },
  {
    field: 'tags',
    description: 'Content tags',
    snippet: 'tags:\n  - $0',
  },
  {
    field: 'draft',
    description: 'Mark as draft',
    snippet: 'draft: ${1|true,false|}',
  },
  {
    field: 'previewTheme',
    description:
      FRONTMATTER_OVERRIDE_MAP.get('previewTheme')?.description ??
      `${EXTENSION_DISPLAY_NAME} theme override`,
    snippet: `previewTheme: \${1|${PREVIEW_THEMES.join(',')}|}`,
  },
  {
    field: 'codeBlockTheme',
    description:
      FRONTMATTER_OVERRIDE_MAP.get('codeBlockTheme')?.description ??
      'Code block theme override',
    snippet: `codeBlockTheme: \${1|${CODE_BLOCK_THEMES.join(',')}|}`,
  },
] as const;

// build generic component completion items from registry snippet data
function buildGenericComponentItems(): vscode.CompletionItem[] {
  const snippets = getGenericComponentSnippets();
  return snippets.map((snippet) => {
    const item = new vscode.CompletionItem(
      snippet.name,
      vscode.CompletionItemKind.Class
    );
    item.insertText = new vscode.SnippetString(snippet.template);
    item.documentation = new vscode.MarkdownString(snippet.doc);
    item.detail = `${EXTENSION_DISPLAY_NAME} - Generic`;
    item.sortText = `0_${snippet.name}`;
    return item;
  });
}

// build framework-specific component completion items from registry
function buildFrameworkComponentItems(
  framework: FrameworkId
): vscode.CompletionItem[] {
  if (framework === 'generic') {
    return [];
  }

  const items: vscode.CompletionItem[] = [];
  const frameworkLabel = framework.charAt(0).toUpperCase() + framework.slice(1);

  const entries = COMPONENT_REGISTRY.filter(
    (entry) => entry.framework === framework && entry.kind === 'component'
  );

  for (const entry of entries) {
    const item = new vscode.CompletionItem(
      entry.name,
      vscode.CompletionItemKind.Class
    );
    item.insertText = new vscode.SnippetString(
      `${entry.name}>\n\t$0\n</${entry.name}>`
    );
    item.detail = `${EXTENSION_DISPLAY_NAME} - ${frameworkLabel}`;
    item.sortText = `1_${entry.name}`;

    if (entry.importSpecifiers.length > 0) {
      item.documentation = new vscode.MarkdownString(
        `${frameworkLabel} component.\n\nImport: \`${entry.importSpecifiers[0]}\``
      );
    }

    items.push(item);
  }

  return items;
}

// build component name completions for JSX context
function buildComponentCompletions(
  document: vscode.TextDocument
): vscode.CompletionItem[] {
  const items: vscode.CompletionItem[] = [];

  // detect framework for context-aware suggestions
  let frameworkId: FrameworkId = 'generic';
  try {
    const detector = getFrameworkDetector();
    const info = detector.getFramework(document.uri);
    frameworkId = info.framework;
  } catch {
    // fallback to generic
  }

  // always include generic components (cached)
  items.push(...cachedGenericItems);

  // add framework-specific components
  if (frameworkId !== 'generic') {
    items.push(...buildFrameworkComponentItems(frameworkId));
  }

  log.debug(
    `Built ${items.length} component completions (framework: ${frameworkId})`
  );
  return items;
}

// build directive type completions for ::: syntax
function buildDirectiveCompletions(): vscode.CompletionItem[] {
  return DIRECTIVE_TYPES.map(({ type }) => {
    const item = new vscode.CompletionItem(
      type,
      vscode.CompletionItemKind.Snippet
    );
    item.insertText = new vscode.SnippetString(`${type}\n$0\n:::`);
    item.documentation = new vscode.MarkdownString(
      `:::${type} directive\n\nInserts:\n\`\`\`\n:::${type}\nContent here\n:::\n\`\`\``
    );
    item.detail = 'MDX Directive';
    item.sortText = `0_${type}`;
    return item;
  });
}

// build GitHub alert completions for > [! syntax
function buildGitHubAlertCompletions(): vscode.CompletionItem[] {
  return GITHUB_ALERT_TYPES.map(({ type }) => {
    const item = new vscode.CompletionItem(
      type,
      vscode.CompletionItemKind.Snippet
    );
    item.insertText = new vscode.SnippetString(`${type}]\n> $0`);
    item.documentation = new vscode.MarkdownString(
      `[!${type}] alert\n\nInserts:\n\`\`\`\n> [!${type}]\n> Content here\n\`\`\``
    );
    item.detail = 'GitHub Alert';
    item.sortText = `0_${type}`;
    return item;
  });
}

// build frontmatter field completions
function buildFrontmatterCompletions(): vscode.CompletionItem[] {
  return FRONTMATTER_FIELDS.map(({ field, description, snippet }) => {
    const item = new vscode.CompletionItem(
      field,
      vscode.CompletionItemKind.Property
    );
    item.insertText = new vscode.SnippetString(snippet);
    item.documentation = new vscode.MarkdownString(description);
    item.detail = 'Frontmatter';
    item.sortText = `0_${field}`;
    return item;
  });
}

// cached static completion items (built once, reused across calls)
const cachedDirectiveItems = buildDirectiveCompletions();
const cachedAlertItems = buildGitHubAlertCompletions();
const cachedFrontmatterItems = buildFrontmatterCompletions();
const cachedGenericItems = buildGenericComponentItems();

// * MDXCompletionProvider
// provide IntelliSense completions for MDX components, directives & frontmatter
export class MDXCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext
  ): vscode.CompletionItem[] | undefined {
    const context = detectCompletionContext(document, position);

    switch (context) {
      case 'jsx-tag':
        return buildComponentCompletions(document);
      case 'directive':
        return cachedDirectiveItems;
      case 'github-alert':
        return cachedAlertItems;
      case 'frontmatter':
        return cachedFrontmatterItems;
      case 'none':
        return undefined;
    }
  }
}
