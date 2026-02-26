// packages/extension/commands/command-names.ts
// command ID constants for type-safe registration

// define command IDs as constants to prevent typos & enable refactoring
// mirrors the pattern from services/service-names.ts
export const CommandNames = {
  // preview commands
  OPEN_PREVIEW: 'mdx-preview.commands.openPreview',
  REFRESH_PREVIEW: 'mdx-preview.commands.refreshPreview',
  OPEN_PREVIEW_FROM_EXPLORER: 'mdx-preview.commands.openPreviewFromExplorer',

  // config toggle commands
  TOGGLE_VSCODE_MARKDOWN_STYLES:
    'mdx-preview.commands.toggleUseVscodeMarkdownStyles',
  TOGGLE_WHITE_BACKGROUND: 'mdx-preview.commands.toggleUseWhiteBackground',

  // security commands
  CHANGE_SECURITY_SETTINGS: 'mdx-preview.commands.changeSecuritySettings',
  TOGGLE_SCRIPTS: 'mdx-preview.commands.toggleScripts',

  // theme commands
  SELECT_PREVIEW_THEME: 'mdx-preview.commands.selectPreviewTheme',
  SELECT_CODE_BLOCK_THEME: 'mdx-preview.commands.selectCodeBlockTheme',
  SELECT_MERMAID_THEME: 'mdx-preview.commands.selectMermaidTheme',

  // framework commands
  SELECT_FRAMEWORK: 'mdx-preview.commands.selectFramework',

  // cache commands
  CLEAR_ALL_CACHES: 'mdx-preview.commands.clearAllCaches',

  // config info commands
  SHOW_EFFECTIVE_CONFIG: 'mdx-preview.commands.showEffectiveConfig',

  // debug commands
  TOGGLE_DEBUG_OUTPUT: 'mdx-preview.commands.toggleDebugOutput',

  // authoring guide commands
  COPY_AUTHORING_GUIDE: 'mdx-preview.commands.copyAuthoringGuide',
} as const;

export type CommandName = (typeof CommandNames)[keyof typeof CommandNames];
