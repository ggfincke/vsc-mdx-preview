// packages/webview-client/src/shared/utils/cn.ts
// class name concatenation utility
// ! cross-repo duplicate: mdx-forge/src/components/internal/cn.ts
// ! changes here must be mirrored (GPL licensing prevents shared dependency)

// concatenates class names, filtering out falsy values
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
