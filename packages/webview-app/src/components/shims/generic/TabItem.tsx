// packages/webview-app/src/components/shims/generic/TabItem.tsx
// Generic TabItem component shim for MDX Preview
// re-export TabItem from base tabs factory

import React, { ReactElement } from 'react';
import { type TabItemProps } from '../base';
import { TabItem } from './Tabs';

// tab component (alias for TabItem)
export function Tab(props: TabItemProps): ReactElement {
  return <TabItem {...props} />;
}

export { TabItem };
export default TabItem;
