// packages/webview-app/src/theme/css.ts
// re-export theme CSS from themes directory
//
// Architecture:
// - theme/  = implementation logic (context, loader, detection)
// - themes/ = CSS data storage (large strings, separate for bundle optimization)
//
// This file bridges the two, allowing theme/ to be the single import point
// while keeping large CSS strings in a separate module for code organization.

export { previewThemes, codeBlockThemes } from '../themes';
