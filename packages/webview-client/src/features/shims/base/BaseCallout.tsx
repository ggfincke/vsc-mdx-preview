// packages/webview-app/src/components/shims/base/BaseCallout.tsx
// factory for creating framework-specific Callout/Aside components

import React, { ReactNode, ReactElement } from 'react';

// icon source configuration - SVG string or React component
export type IconSource<T extends string> =
  | { type: 'svg'; icons: Record<T, string> }
  | { type: 'component'; icons: Record<T, React.FC<{ size?: number }>> };

// configuration for creating a callout component
export interface BaseCalloutConfig<T extends string> {
  classPrefix: string;
  types: readonly T[];
  defaultType: T;
  icons: IconSource<T>;
  defaultTitles: Record<T, string>;
  // 'header' wrap icon+title, 'inline' render icon directly
  layout: 'header' | 'inline';
}

// common callout props
export interface BaseCalloutProps<T extends string> {
  children: ReactNode;
  type?: T;
  title?: string;
  // override default icon
  icon?: ReactNode;
  className?: string;
}

// render an icon from SVG string
function SvgIcon({
  svg,
  className,
}: {
  svg: string;
  className?: string;
}): ReactElement {
  return (
    <span className={className} dangerouslySetInnerHTML={{ __html: svg }} />
  );
}

// render an icon from React component
function ComponentIcon({
  Icon,
  size,
  className,
}: {
  Icon: React.FC<{ size?: number }>;
  size?: number;
  className?: string;
}): ReactElement {
  return (
    <span className={className}>
      <Icon size={size} />
    </span>
  );
}

// factory function to create framework-specific Callout components
// all implementations share the same core logic
export function createCallout<T extends string>(
  config: BaseCalloutConfig<T>
): React.FC<BaseCalloutProps<T>> {
  const { classPrefix, defaultType, icons, defaultTitles, layout } = config;

  function Callout({
    children,
    type,
    title,
    icon,
    className,
  }: BaseCalloutProps<T>): ReactElement {
    const effectiveType = (type ?? defaultType) as T;
    const displayTitle = title ?? defaultTitles[effectiveType];

    // build CSS class
    const rootClass = className
      ? `${classPrefix} ${classPrefix}-${effectiveType} ${className}`
      : `${classPrefix} ${classPrefix}-${effectiveType}`;

    // render icon
    const renderIcon = (): ReactElement | null => {
      // custom icon takes precedence
      if (icon) {
        return (
          <span className={`${classPrefix}-icon`}>{icon}</span>
        );
      }

      // render from configured icon source
      if (icons.type === 'svg') {
        const svg = icons.icons[effectiveType];
        if (svg) {
          return <SvgIcon svg={svg} className={`${classPrefix}-icon`} />;
        }
      } else {
        const IconComponent = icons.icons[effectiveType];
        if (IconComponent) {
          return (
            <ComponentIcon
              Icon={IconComponent}
              size={16}
              className={`${classPrefix}-icon`}
            />
          );
        }
      }
      return null;
    };

    // header layout (Generic, Starlight)
    if (layout === 'header') {
      return (
        <aside className={rootClass} data-callout-type={effectiveType}>
          <div className={`${classPrefix}-header`}>
            {renderIcon()}
            <span className={`${classPrefix}-title`}>{displayTitle}</span>
          </div>
          <div className={`${classPrefix}-content`}>{children}</div>
        </aside>
      );
    }

    // inline layout (Nextra)
    return (
      <aside className={rootClass}>
        {renderIcon()}
        <div className={`${classPrefix}-content`}>{children}</div>
      </aside>
    );
  }

  return Callout;
}

// re-export for convenience
export type { IconSource };
