// public root surface: factory primitives for custom component assemblies

export {
  createTabs,
  createIndexTabs,
  type BaseTabsConfig,
  type BaseTabsProps,
  type CreateTabsResult,
} from './base/BaseTabs';
export {
  createCallout,
  type BaseCalloutConfig,
  type BaseCalloutProps,
  type IconSource,
} from './base/BaseCallout';
export {
  createCollapsible,
  type CollapsibleConfig,
  type BaseCollapsibleProps,
} from './base/createCollapsible';
export { createCodeBlock, type BaseCodeBlockProps } from './base/BaseCodeBlock';
export { BaseCard, type BaseCardProps } from './base/BaseCard';
export { CopyButton, type CopyButtonProps } from './base/CopyButton';
export {
  createIconComponent,
  type IconProps,
} from './base/createIconComponent';
