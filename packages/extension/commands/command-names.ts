// packages/extension/commands/command-names.ts
// command ID constants for type-safe registration

// Command IDs as constants to prevent typos & enable refactoring.
// Mirrors the pattern from services/service-names.ts.
export const CommandNames = {
  // preview commands
  OPEN_PREVIEW: 'mdx-preview.commands.openPreview',
  REFRESH_PREVIEW: 'mdx-preview.commands.refreshPreview',

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

  // zoom commands
  ZOOM_IN: 'mdx-preview.commands.zoomIn',
  ZOOM_OUT: 'mdx-preview.commands.zoomOut',
  RESET_ZOOM: 'mdx-preview.commands.resetZoom',

  // framework commands
  SELECT_FRAMEWORK: 'mdx-preview.commands.selectFramework',

  // cache commands
  REFRESH_MODULE_CACHE: 'mdx-preview.commands.refreshModuleCache',
} as const;

export type CommandName = (typeof CommandNames)[keyof typeof CommandNames];
