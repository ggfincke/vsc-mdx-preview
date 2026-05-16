// packages/webview-client/src/shared/utils/cn.ts
// class name concatenation utility
// ! cross-repo duplicate; mirror changes in mdx-forge cn utility

// concatenates class names, filtering out falsy values
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
