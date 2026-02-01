// packages/webview-app/src/theme/css.ts
// re-export theme CSS from themes directory
//
// architecture
// - theme/  = implementation logic (context, loader, detection)
// - themes/ = CSS data storage (large strings, separate for bundle optimization)
//
// this file bridges the two, allowing theme/ to be the single import point
// while keeping large CSS strings in separate module for code organization

export { previewThemes, codeBlockThemes } from '../themes';
