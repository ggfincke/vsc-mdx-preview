// packages/webview-app/src/utils/cn.ts
// Class name concatenation utility

// concatenates class names, filtering out falsy values
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
