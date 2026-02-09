// packages/webview-app/src/components/shims/nextra/Steps.tsx
// Nextra Steps component shim for MDX Preview

import { Steps as StarlightSteps } from '../starlight/Steps';
import { createNextraWrapper, type NextraWrapperProps } from './createNextraWrapper';

// Steps props (compatible w/ Nextra)
export type StepsProps = NextraWrapperProps;

// Steps component - wrap Starlight's implementation w/ Nextra styling
export const Steps = createNextraWrapper({
  StarlightComponent: StarlightSteps,
  wrapperClassName: 'mdx-preview-nextra-steps',
  displayName: 'NextraSteps',
});

export default Steps;
