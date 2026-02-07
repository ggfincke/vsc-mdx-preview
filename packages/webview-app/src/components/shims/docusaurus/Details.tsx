// packages/webview-app/src/components/shims/docusaurus/Details.tsx
// Docusaurus Details component shim for MDX Preview

import {
  createCollapsible,
  DOCUSAURUS_DETAILS_CLASSES,
  type BaseCollapsibleProps,
} from '../base/createCollapsible';

// create base details w/ Docusaurus configuration
// use native toggle handling (more semantic)
const BaseDetails = createCollapsible({
  classNames: DOCUSAURUS_DETAILS_CLASSES,
  iconSize: 14,
  useNativeToggle: true,
  applyOpenClassToWrapper: false,
  defaultSummary: 'Details',
});

// details props (compatible w/ Docusaurus)
export type DetailsProps = BaseCollapsibleProps;

// Docusaurus Details component
export function Details(props: DetailsProps) {
  return <BaseDetails {...props} />;
}

export default Details;
