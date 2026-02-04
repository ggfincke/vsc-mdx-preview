// packages/webview-app/src/components/shims/generic/Collapsible.tsx
// Generic Collapsible/Accordion component shim for MDX Preview

import { createCollapsible } from '../base/createCollapsible';
import { GENERIC_COLLAPSIBLE_CLASSES } from '../base/BaseCollapsible';
import { CollapsibleProps } from './types';

// create base collapsible w/ generic configuration
// uses custom click handling (prevents native toggle for more control)
const BaseCollapsible = createCollapsible({
  classNames: GENERIC_COLLAPSIBLE_CLASSES,
  iconSize: 16,
  useNativeToggle: false,
  applyOpenClassToWrapper: true,
});

// generic Collapsible component
export function Collapsible(props: CollapsibleProps) {
  return <BaseCollapsible {...props} />;
}

// accordion component (alias for Collapsible)
export function Accordion(props: CollapsibleProps) {
  return <Collapsible {...props} />;
}

export default Collapsible;
