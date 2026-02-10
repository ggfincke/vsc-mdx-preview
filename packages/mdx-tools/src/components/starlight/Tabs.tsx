// packages/webview-app/src/components/shims/starlight/Tabs.tsx
// Starlight Tabs/TabItem component shim for MDX Preview
// re-exports Docusaurus Tabs since they have compatible APIs

// Starlight & Docusaurus tabs have nearly identical APIs
// re-export the Docusaurus implementation for Starlight compatibility
export { Tabs, TabItem } from '../docusaurus/Tabs';
export type { TabsProps, TabItemProps } from '../docusaurus/Tabs';
