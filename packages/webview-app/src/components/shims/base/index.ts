// packages/webview-app/src/components/shims/base/index.ts
// barrel exports for base shim utilities

export {
  useTabState,
  extractTabItems,
  type TabItem,
  type TabDefinition,
  type TabItemProps,
  type UseTabStateOptions,
  type UseTabStateResult,
} from './useTabState';

export {
  createTabs,
  type BaseTabsConfig,
  type BaseTabsProps,
  type CreateTabsResult,
} from './BaseTabs';

export { BaseCard, ArrowIcon, type BaseCardProps } from './BaseCard';

export {
  useCopyToClipboard,
  type UseCopyToClipboardResult,
} from './useCopyToClipboard';

export { extractTextContent } from './extractTextContent';

export { CopyButton, type CopyButtonProps } from './CopyButton';

export { CALLOUT_ICONS, FILE_TREE_ICONS, CODE_ICONS } from './icons';

export {
  createCallout,
  type BaseCalloutConfig,
  type BaseCalloutProps,
  type IconSource,
} from './BaseCallout';
