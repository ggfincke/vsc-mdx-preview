// packages/extension-host/src/features/language/MDXCompletionProvider.ts
// provide IntelliSense completions for MDX components, directives, alerts & frontmatter

import * as vscode from 'vscode';
import { createTaggedLogger } from '../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import type { FrameworkId } from '@mdx-preview/contracts';
import { COMPONENT_REGISTRY } from 'mdx-forge/components/registry';
import { getFrameworkDetector } from '../../app/services';

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

// check if line is within frontmatter region
function isInFrontmatter(
  document: vscode.TextDocument,
  lineNumber: number
): boolean {
  if (lineNumber === 0) {
    return false;
  }

  // frontmatter must start at line 0 w/ ---
  if (document.lineAt(0).text.trim() !== '---') {
    return false;
  }

  // find closing ---
  for (let i = 1; i <= lineNumber; i++) {
    if (document.lineAt(i).text.trim() === '---') {
      // closing --- found before or at cursor line
      return i > lineNumber;
    }
  }

  // no closing --- found yet, still in frontmatter
  return true;
}

// detect completion context from line text & cursor position
function detectCompletionContext(
  document: vscode.TextDocument,
  position: vscode.Position
): CompletionContext {
  const line = document.lineAt(position.line).text;
  const textBeforeCursor = line.substring(0, position.character);

  // check if in frontmatter (between --- delimiters)
  if (isInFrontmatter(document, position.line)) {
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

// directive type suggestions for ::: syntax
const DIRECTIVE_TYPES = [
  { type: 'note', description: 'Informational note' },
  { type: 'tip', description: 'Helpful tip or suggestion' },
  { type: 'warning', description: 'Warning message' },
  { type: 'danger', description: 'Danger/error alert' },
  { type: 'caution', description: 'Caution notice' },
  { type: 'important', description: 'Important information' },
  { type: 'info', description: 'General information' },
] as const;

// GitHub-style alert types (> [!TYPE])
const GITHUB_ALERT_TYPES = [
  { type: 'NOTE', description: 'Highlights information for attention' },
  { type: 'TIP', description: 'Helpful advice for improved outcomes' },
  { type: 'WARNING', description: 'Urgent attention needed, potential risks' },
  { type: 'CAUTION', description: 'Advises about risks or negative outcomes' },
  { type: 'IMPORTANT', description: 'Key information for success' },
] as const;

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
    description: 'MDX Preview theme override',
    snippet: 'previewTheme: ${1|github-light,github-dark|}',
  },
  {
    field: 'codeBlockTheme',
    description: 'Code block theme override',
    snippet: 'codeBlockTheme: $0',
  },
] as const;

// build generic component completion items w/ rich snippets
function buildGenericComponentItems(): vscode.CompletionItem[] {
  const items: vscode.CompletionItem[] = [];

  // Callout
  const callout = new vscode.CompletionItem(
    'Callout',
    vscode.CompletionItemKind.Class
  );
  callout.insertText = new vscode.SnippetString(
    'Callout type="${1|note,tip,warning,danger,info,caution,important|}">\n\t$0\n</Callout>'
  );
  callout.documentation = new vscode.MarkdownString(
    'Callout/admonition component.\n\n' +
      'Props: `type`, `title`, `icon`, `className`\n\n' +
      'Types: note, tip, warning, danger, info, caution, important, summary, hint, success, question, failure, bug, example, quote, todo, attention\n\n' +
      'Aliases: Alert, Admonition'
  );
  callout.detail = 'MDX Preview - Generic';
  callout.sortText = '0_Callout';
  items.push(callout);

  // Tabs
  const tabs = new vscode.CompletionItem(
    'Tabs',
    vscode.CompletionItemKind.Class
  );
  tabs.insertText = new vscode.SnippetString(
    'Tabs>\n\t<TabItem value="${1:tab1}" label="${2:Tab 1}">\n\t\t$0\n\t</TabItem>\n\t<TabItem value="${3:tab2}" label="${4:Tab 2}">\n\t\t\n\t</TabItem>\n</Tabs>'
  );
  tabs.documentation = new vscode.MarkdownString(
    'Tab container component. Use w/ `<TabItem>` children.\n\n' +
      'Props: `defaultValue`, `values`, `groupId`, `className`'
  );
  tabs.detail = 'MDX Preview - Generic';
  tabs.sortText = '0_Tabs';
  items.push(tabs);

  // TabItem
  const tabItem = new vscode.CompletionItem(
    'TabItem',
    vscode.CompletionItemKind.Class
  );
  tabItem.insertText = new vscode.SnippetString(
    'TabItem value="${1:value}" label="${2:Label}">\n\t$0\n</TabItem>'
  );
  tabItem.documentation = new vscode.MarkdownString(
    'Tab content panel. Must be a child of `<Tabs>`.\n\n' +
      'Props: `value`, `label`, `default`\n\n' +
      'Aliases: Tab'
  );
  tabItem.detail = 'MDX Preview - Generic';
  tabItem.sortText = '0_TabItem';
  items.push(tabItem);

  // Collapsible
  const collapsible = new vscode.CompletionItem(
    'Collapsible',
    vscode.CompletionItemKind.Class
  );
  collapsible.insertText = new vscode.SnippetString(
    'Collapsible title="${1:Title}">\n\t$0\n</Collapsible>'
  );
  collapsible.documentation = new vscode.MarkdownString(
    'Collapsible/accordion section.\n\n' +
      'Props: `title` (required), `defaultOpen`, `summary`\n\n' +
      'Aliases: Accordion, Details'
  );
  collapsible.detail = 'MDX Preview - Generic';
  collapsible.sortText = '0_Collapsible';
  items.push(collapsible);

  // CodeGroup
  const codeGroup = new vscode.CompletionItem(
    'CodeGroup',
    vscode.CompletionItemKind.Class
  );
  codeGroup.insertText = new vscode.SnippetString(
    'CodeGroup>\n$0\n</CodeGroup>'
  );
  codeGroup.documentation = new vscode.MarkdownString(
    'Group multiple code blocks in tabs.\n\n' +
      'Props: `labels` (optional, array of tab labels)'
  );
  codeGroup.detail = 'MDX Preview - Generic';
  codeGroup.sortText = '0_CodeGroup';
  items.push(codeGroup);

  return items;
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
    item.detail = `MDX Preview - ${frameworkLabel}`;
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
  return DIRECTIVE_TYPES.map(({ type, description }) => {
    const item = new vscode.CompletionItem(
      type,
      vscode.CompletionItemKind.Snippet
    );
    item.insertText = new vscode.SnippetString(`${type}\n$0\n:::`);
    item.documentation = new vscode.MarkdownString(
      `${description}\n\nInserts:\n\`\`\`\n:::${type}\nContent here\n:::\n\`\`\``
    );
    item.detail = 'MDX Directive';
    item.sortText = `0_${type}`;
    return item;
  });
}

// build GitHub alert completions for > [! syntax
function buildGitHubAlertCompletions(): vscode.CompletionItem[] {
  return GITHUB_ALERT_TYPES.map(({ type, description }) => {
    const item = new vscode.CompletionItem(
      type,
      vscode.CompletionItemKind.Snippet
    );
    item.insertText = new vscode.SnippetString(`${type}]\n> $0`);
    item.documentation = new vscode.MarkdownString(
      `${description}\n\nInserts:\n\`\`\`\n> [!${type}]\n> Content here\n\`\`\``
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
