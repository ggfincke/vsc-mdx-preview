// packages/webview-app/src/components/shims/nextra/index.ts
// Nextra component shims - using compound component pattern
// Provides all components available in nextra/components

export { Callout } from './Callout';
export type { CalloutProps, CalloutType } from './Callout';

// Tabs uses compound pattern: Tabs and Tabs.Tab
export { Tabs } from './Tabs';
export type { TabsProps, TabProps, TabItem } from './Tabs';

// Cards uses compound pattern: Cards and Cards.Card
export { Cards } from './Cards';
export type { CardsProps, CardProps } from './Cards';

export { FileTree } from './FileTree';
export type { FileTreeProps } from './FileTree';

export { Steps } from './Steps';
export type { StepsProps } from './Steps';

export { Bleed } from './Bleed';
export type { BleedProps } from './Bleed';
