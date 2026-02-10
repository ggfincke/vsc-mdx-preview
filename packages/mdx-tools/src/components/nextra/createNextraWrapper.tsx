// packages/webview-app/src/components/shims/nextra/createNextraWrapper.tsx
// factory for creating Nextra wrapper components around Starlight components

import React, { ReactNode, HTMLAttributes, ComponentType } from 'react';

// configuration for creating a Nextra wrapper component
type WrapperChildProps = {
  children: ReactNode;
};

export interface NextraWrapperConfig {
  // Starlight component to wrap
  StarlightComponent: ComponentType<WrapperChildProps>;
  // CSS class for the wrapper div
  wrapperClassName: string;
  // display name for debugging
  displayName: string;
}

// common wrapper props (extends HTMLDivElement attributes)
export type NextraWrapperProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

// factory function to create Nextra wrapper components
// wrap Starlight components w/ Nextra-specific styling
export function createNextraWrapper(config: NextraWrapperConfig): React.FC<NextraWrapperProps> {
  const { StarlightComponent, wrapperClassName, displayName } = config;

  function NextraWrapper({ children, className, ...props }: NextraWrapperProps) {
    const classes = [wrapperClassName, className].filter(Boolean).join(' ');

    return (
      <div className={classes} {...props}>
        <StarlightComponent>{children}</StarlightComponent>
      </div>
    );
  }

  NextraWrapper.displayName = displayName;

  return NextraWrapper;
}
